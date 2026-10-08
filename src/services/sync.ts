import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

import { EXPO_GO_GOOGLE } from "@/runtime/expoGo";

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

export function configureGoogle(): void {
  return;
}

export async function signInWithGoogle(): Promise<GoogleAccount> {
  throw new Error(EXPO_GO_GOOGLE);
}

export async function signOutGoogle(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function addGoogleScope(_scope: string): Promise<void> {
  throw new Error(EXPO_GO_GOOGLE);
}

async function accessToken(): Promise<string> {
  throw new Error(EXPO_GO_GOOGLE);
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
