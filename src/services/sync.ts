import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

import { EXPO_GO_GOOGLE, isExpoGo } from "@/runtime/expoGo";

import { runSync } from "@/domain/sync/engine";
import type { Repository } from "@/db/repository";
import { createId } from "@/db/repository";

import { GoogleApiError, GoogleSyncClient } from "./googleApi";

const TOKEN_KEY = "okorema.google.accessToken";

export const GOOGLE_SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar",
  tasks: "https://www.googleapis.com/auth/tasks",
  keep: "https://www.googleapis.com/auth/keep",
} as const;

export type GoogleAccount = {
  email: string;
  name: string;
  hostedDomain: string | null;
};

type GoogleExtra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
};

export function googleConfig(): { webClientId: string; iosClientId: string; configured: boolean } {
  const extra = (Constants.expoConfig?.extra ?? {}) as GoogleExtra;
  const webClientId = extra.googleWebClientId ?? "";
  const iosClientId = extra.googleIosClientId ?? "";
  return { webClientId, iosClientId, configured: Boolean(webClientId) };
}

type GoogleSigninApi = {
  configure: (options: { webClientId: string; iosClientId?: string; scopes: string[]; offlineAccess: boolean }) => void;
  hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
  signIn: () => Promise<
    | { type: "success"; data: { idToken: string | null; user: { email: string; name: string | null } } }
    | { type: string }
  >;
  signOut: () => Promise<void>;
  addScopes: (options: { scopes: string[] }) => Promise<unknown>;
  getTokens: () => Promise<{ accessToken: string }>;
};

function googleSignin(): GoogleSigninApi {
  if (isExpoGo()) {
    throw new Error(EXPO_GO_GOOGLE);
  }
  // The package calls TurboModuleRegistry.getEnforcing at import time, which crashes Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require("@react-native-google-signin/google-signin") as { GoogleSignin: GoogleSigninApi };
  return loaded.GoogleSignin;
}

export function configureGoogle(): void {
  if (isExpoGo()) {
    return;
  }
  const config = googleConfig();
  if (!config.configured) {
    return;
  }
  googleSignin().configure({
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    scopes: ["email", "profile"],
    offlineAccess: true,
  });
}

function decodePayload(idToken: string | null): { hd?: string; email?: string } {
  if (!idToken) return {};
  const part = idToken.split(".")[1];
  if (!part) return {};
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(globalThis.atob(padded)) as { hd?: string; email?: string };
  } catch {
    return {};
  }
}

export async function signInWithGoogle(): Promise<GoogleAccount> {
  if (isExpoGo()) {
    throw new Error(EXPO_GO_GOOGLE);
  }
  if (!googleConfig().configured) {
    throw new Error("missing-google-config");
  }
  const google = googleSignin();
  configureGoogle();
  await google.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await google.signIn();
  if (response.type !== "success" || !("data" in response)) {
    throw new Error("cancelled");
  }
  const tokens = await google.getTokens();
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
  const payload = decodePayload(response.data.idToken);
  return {
    email: response.data.user.email,
    name: response.data.user.name ?? response.data.user.email,
    hostedDomain: payload.hd ?? null,
  };
}

export async function signOutGoogle(): Promise<void> {
  if (!isExpoGo()) {
    configureGoogle();
    await googleSignin().signOut();
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function addGoogleScope(scope: string): Promise<void> {
  if (isExpoGo()) {
    throw new Error(EXPO_GO_GOOGLE);
  }
  const google = googleSignin();
  configureGoogle();
  await google.addScopes({ scopes: [scope] });
  const tokens = await google.getTokens();
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
}

async function accessToken(): Promise<string> {
  if (isExpoGo()) {
    throw new Error(EXPO_GO_GOOGLE);
  }
  const google = googleSignin();
  configureGoogle();
  const tokens = await google.getTokens();
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
  return tokens.accessToken;
}

export async function syncGoogle(repo: Repository): Promise<{ warnings: string[]; error: string | null }> {
  const settings = await repo.settings();
  if (!settings.googleAccount) {
    return { warnings: [], error: null };
  }
  const account = JSON.parse(settings.googleAccount) as GoogleAccount;
  const enableCalendar = settings.syncCalendar === "1";
  const enableTasks = settings.syncTasks === "1";
  const enableKeep = settings.syncKeep === "1";
  if (!enableCalendar && !enableTasks && !enableKeep) {
    return { warnings: [], error: null };
  }
  const client = new GoogleSyncClient(accessToken);
  let keepAvailable = enableKeep && Boolean(account.hostedDomain);
  if (enableKeep && keepAvailable) {
    await client.listNotes();
    if (client.keepBlocked) {
      keepAvailable = false;
      await repo.setSetting("keepStatus", "unavailable");
    } else {
      await repo.setSetting("keepStatus", "eligible");
    }
  } else if (enableKeep) {
    await repo.setSetting("keepStatus", "personal");
  }
  const lists = await repo.lists();
  const defaultListId = lists.find((list) => !list.deletedAt)?.id ?? "";
  try {
    const result = await runSync(
      {
        lists,
        reminders: await repo.reminders(),
        mappings: await repo.mappings(),
      },
      {
        now: new Date().toISOString(),
        createId,
        defaultListId,
        calendarId: enableCalendar ? settings.calendarId || null : null,
        enableCalendar: enableCalendar && Boolean(settings.calendarId),
        enableTasks,
        enableKeep,
        keepAvailable,
      },
      client,
    );
    for (const list of result.state.lists) {
      await repo.saveList(list);
    }
    for (const reminder of result.state.reminders) {
      await repo.saveReminder(reminder);
    }
    await repo.replaceMappings(result.state.mappings);
    await repo.setSetting("lastSyncAt", new Date().toISOString());
    await repo.setSetting("lastSyncError", "");
    return { warnings: result.warnings, error: null };
  } catch (error) {
    const message = error instanceof GoogleApiError ? error.message : error instanceof Error ? error.message : "sync-failed";
    await repo.setSetting("lastSyncError", message.slice(0, 500));
    return { warnings: [], error: message };
  }
}

export async function listGoogleCalendars() {
  return new GoogleSyncClient(accessToken).listCalendars();
}

export async function createOkoremaCalendar() {
  return new GoogleSyncClient(accessToken).createDedicatedCalendar();
}
