import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import type { BudgetReport } from "@/domain/schedule";
import type { CompletionLog, Reminder, ReminderList } from "@/domain/types";
import type { Repository } from "@/db/repository";
import { createId } from "@/db/repository";
import { deviceLocale, messagesFor, type AppLocale } from "@/i18n";
import type { Messages } from "@/i18n/messages";
import { exportBackupFile, importBackupFile } from "@/services/backupFile";
import { purchasePro, restoreProPurchase } from "@/services/entitlement";
import { getOkoremaNative } from "okorema-native";
import {
  androidAlarmStatus,
  notificationPermissionGranted,
  openExactAlarmSettings,
  openFullScreenSettings,
  prepareNotificationCategories,
  requestNotificationPermission,
} from "@/services/scheduler";
import {
  configureGoogle,
  createOkoremaCalendar,
  listGoogleCalendars,
  signInWithGoogle,
  signOutGoogle,
  syncGoogle,
  type GoogleAccount,
} from "@/services/sync";

import {
  commitComplete,
  commitSnooze,
  commitSnoozeAll,
  commitUndo,
  enqueue,
  importDeviceItems,
  isProFrom,
  loadAll,
  onDataChanged,
  openAppRepository,
  reschedule,
  seedDemo,
} from "@/state/actions";
import { consumeNativeActions, ensureBackgroundSync, listenForIosWidgetCompletions } from "@/bootstrap";

type Snapshot = {
  lists: ReminderList[];
  reminders: Reminder[];
  logs: CompletionLog[];
  settings: Record<string, string>;
};

type Store = Snapshot & {
  ready: boolean;
  error: string | null;
  locale: AppLocale;
  messages: Messages;
  budget: BudgetReport | null;
  notifGranted: boolean;
  exactAlarm: boolean;
  fullScreenIntent: boolean;
  notice: string | null;
  busy: boolean;
  now: Date;
  onboarded: boolean;
  isPro: boolean;
  account: GoogleAccount | null;
  clearNotice: () => void;
  refresh: () => Promise<void>;
  saveList: (list: ReminderList) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  reorderList: (listId: string, direction: -1 | 1) => Promise<void>;
  saveReminder: (reminder: Reminder) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  complete: (reminder: Reminder) => Promise<void>;
  snooze: (reminder: Reminder) => Promise<void>;
  snoozeAllOverdue: () => Promise<void>;
  undo: (reminderId: string) => Promise<void>;
  setFlag: (key: string, value: string) => Promise<void>;
  toggleDevPro: () => Promise<void>;
  buyPro: () => Promise<void>;
  restorePro: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<string[]>;
  calendars: () => ReturnType<typeof listGoogleCalendars>;
  makeCalendar: () => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  importDevice: () => Promise<void>;
  seed: () => Promise<void>;
  allowNotifications: () => Promise<boolean>;
  markNotifAsked: () => Promise<void>;
  openExact: () => void;
  openFullScreen: () => void;
};

const AppContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const locale = deviceLocale();
  const messages = messagesFor(locale);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ lists: [], reminders: [], logs: [], settings: {} });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetReport | null>(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [exactAlarm, setExactAlarm] = useState(true);
  const [fullScreenIntent, setFullScreenIntent] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const apply = useCallback(async (repository: Repository) => {
    const data = await loadAll(repository);
    setSnapshot(data);
    const report = await reschedule(repository, deviceLocale(), isProFrom(data.settings));
    setBudget(report);
    setNotifGranted(await notificationPermissionGranted().catch(() => false));
    const alarms = androidAlarmStatus();
    setExactAlarm(alarms.exact);
    setFullScreenIntent(alarms.fullScreen);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        configureGoogle();
        await prepareNotificationCategories(deviceLocale()).catch(() => undefined);
        const repository = await openAppRepository();
        if (cancelled) {
          return;
        }
        setRepo(repository);
        await apply(repository);
        await consumeNativeActions();
        await ensureBackgroundSync();
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "load-failed");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => onDataChanged(() => {
    if (repo) {
      void apply(repo);
    }
  }), [apply, repo]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && repo) {
        setNow(new Date());
        void consumeNativeActions().then(() => apply(repo));
      }
    });
    const timer = setInterval(() => setNow(new Date()), 15000);
    const stopWidgets = listenForIosWidgetCompletions();
    return () => {
      subscription.remove();
      clearInterval(timer);
      stopWidgets();
    };
  }, [apply, repo]);

  const run = useCallback(
    async (work: (repository: Repository) => Promise<void>) => {
      if (!repo) {
        return;
      }
      setBusy(true);
      try {
        await enqueue(() => work(repo));
        await apply(repo);
      } finally {
        setBusy(false);
      }
    },
    [apply, repo],
  );

  const account = useMemo(() => {
    if (!snapshot.settings.googleAccount) {
      return null;
    }
    try {
      return JSON.parse(snapshot.settings.googleAccount) as GoogleAccount;
    } catch {
      return null;
    }
  }, [snapshot.settings.googleAccount]);

  const value = useMemo<Store>(() => {
    const isPro = isProFrom(snapshot.settings);
    return {
      ...snapshot,
      ready,
      error,
      locale,
      messages,
      budget,
      notifGranted,
      exactAlarm,
      fullScreenIntent,
      notice,
      busy,
      now,
      onboarded: snapshot.settings.onboarded === "1",
      isPro,
      account,
      clearNotice: () => setNotice(null),
      refresh: async () => {
        if (repo) {
          await apply(repo);
        }
      },
      saveList: (list) => run((repository) => repository.saveList(list)),
      deleteList: (listId) =>
        run(async (repository) => {
          const stamp = new Date().toISOString();
          const list = (await repository.lists()).find((item) => item.id === listId);
          if (list) {
            await repository.saveList({ ...list, deletedAt: stamp, updatedAt: stamp });
          }
          for (const reminder of await repository.reminders()) {
            if (reminder.listId === listId && !reminder.deletedAt) {
              await repository.saveReminder({ ...reminder, deletedAt: stamp, updatedAt: stamp });
            }
          }
        }),
      reorderList: (listId, direction) =>
        run(async (repository) => {
          const lists = (await repository.lists()).filter((item) => !item.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
          const index = lists.findIndex((item) => item.id === listId);
          const swap = index + direction;
          if (index < 0 || swap < 0 || swap >= lists.length) {
            return;
          }
          const current = lists[index];
          const other = lists[swap];
          await repository.saveList({ ...current, sortOrder: other.sortOrder });
          await repository.saveList({ ...other, sortOrder: current.sortOrder });
        }),
      saveReminder: (reminder) => run((repository) => repository.saveReminder(reminder)),
      deleteReminder: (reminderId) =>
        run(async (repository) => {
          const reminder = (await repository.reminders()).find((item) => item.id === reminderId);
          if (!reminder) {
            return;
          }
          const stamp = new Date().toISOString();
          await repository.saveReminder({ ...reminder, deletedAt: stamp, updatedAt: stamp });
        }),
      complete: (reminder) =>
        run(async (repository) => {
          await commitComplete(repository, reminder.id, reminder.occurrenceKey, `tap:${reminder.id}:${reminder.occurrenceKey}:${Date.now()}`);
          setNotice(messages.completedJustNow);
        }),
      snooze: (reminder) =>
        run(async (repository) => {
          await commitSnooze(repository, reminder.id, reminder.occurrenceKey, `snooze:${reminder.id}:${reminder.occurrenceKey}:${Date.now()}`);
        }),
      snoozeAllOverdue: () => run((repository) => commitSnoozeAll(repository)),
      undo: (reminderId) =>
        run(async (repository) => {
          const restored = await commitUndo(repository, reminderId, `undo:${reminderId}:${Date.now()}`);
          if (restored) {
            setNotice(messages.undone);
          }
        }),
      setFlag: (key, flag) => run((repository) => repository.setSetting(key, flag)),
      toggleDevPro: () =>
        run(async (repository) => {
          const settings = await repository.settings();
          const next = settings.proDevUnlock === "1" ? "0" : "1";
          await repository.setSetting("proDevUnlock", next);
          setNotice(next === "1" ? messages.devUnlock : messages.devLock);
        }),
      buyPro: () =>
        run(async (repository) => {
          const owned = await purchasePro();
          if (owned) {
            await repository.setSetting("proStoreUnlocked", "1");
            setNotice(messages.proUnlocked);
          }
        }),
      restorePro: () =>
        run(async (repository) => {
          const owned = await restoreProPurchase();
          await repository.setSetting("proStoreUnlocked", owned ? "1" : "0");
          setNotice(owned ? messages.proUnlocked : messages.syncFailed);
        }),
      signIn: () =>
        run(async (repository) => {
          try {
            const signed = await signInWithGoogle();
            await repository.setSetting("googleAccount", JSON.stringify(signed));
            setNotice(messages.signedInAs(signed.email));
          } catch (cause) {
            const code = cause instanceof Error ? cause.message : "";
            setNotice(code === "missing-google-config" ? messages.missingGoogleConfig : messages.syncFailed);
          }
        }),
      signOut: () =>
        run(async (repository) => {
          await signOutGoogle().catch(() => undefined);
          await repository.setSetting("googleAccount", "");
        }),
      syncNow: async () => {
        if (!repo) {
          return [];
        }
        setBusy(true);
        try {
          const result = await enqueue(() => syncGoogle(repo));
          await apply(repo);
          if (result.error) {
            setNotice(messages.syncFailed);
          }
          return result.warnings;
        } finally {
          setBusy(false);
        }
      },
      calendars: () => listGoogleCalendars(),
      makeCalendar: () =>
        run(async (repository) => {
          const calendar = await createOkoremaCalendar();
          await repository.setSetting("calendarId", calendar.id);
          await repository.setSetting("calendarSummary", calendar.summary);
          await repository.setSetting("syncCalendar", "1");
        }),
      exportBackup: async () => {
        if (!repo) {
          return;
        }
        await exportBackupFile(repo);
      },
      importBackup: () =>
        run(async (repository) => {
          const result = await importBackupFile(repository);
          if ("error" in result) {
            setNotice(messages.importFailed);
            return;
          }
          setNotice(messages.importAdded(result.lists, result.reminders));
        }),
      importDevice: () =>
        run(async (repository) => {
          const native = getOkoremaNative();
          if (!native) {
            setNotice(messages.importDeviceAndroid);
            return;
          }
          const result = await native.importDeviceReminders();
          if (!result.granted) {
            setNotice(messages.importDenied);
            return;
          }
          const count = await importDeviceItems(repository, result.items);
          setNotice(messages.importResult(count));
        }),
      seed: () => run((repository) => seedDemo(repository)),
      allowNotifications: async () => {
        const granted = await requestNotificationPermission();
        setNotifGranted(granted);
        if (repo) {
          await repo.setSetting("notifAsked", "1");
          await apply(repo);
        }
        return granted;
      },
      markNotifAsked: async () => {
        if (repo) {
          await repo.setSetting("notifAsked", "1");
          await apply(repo);
        }
      },
      openExact: openExactAlarmSettings,
      openFullScreen: openFullScreenSettings,
    };
  }, [
    account,
    apply,
    budget,
    busy,
    error,
    exactAlarm,
    fullScreenIntent,
    locale,
    messages,
    notice,
    notifGranted,
    now,
    ready,
    repo,
    run,
    snapshot,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp outside provider");
  }
  return value;
}

export { createId };
