import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { escalationCopy, preNotifyCopy, type AppLocale } from "@/domain/copy";
import { effectivePersistence, IOS_PENDING_NOTIFICATION_LIMIT } from "@/domain/escalation";
import { markDelivered, planNotifications, type BudgetReport, type ScheduleReminder } from "@/domain/schedule";
import { buildWidgetSnapshot } from "@/domain/snapshot";
import type { CompletionLog, EscalationState, Reminder } from "@/domain/types";
import { upcomingReminders, effectiveDueIso } from "@/domain/overdue";
import { messagesFor, formatDue } from "@/i18n";
import { getOkoremaNative } from "okorema-native";

import type { Repository } from "@/db/repository";

const ANDROID_ALARM_BUDGET = 180;

export type NativeAction = {
  reminderId: string;
  occurrenceKey: string;
  action: "complete" | "snooze";
  at: number;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function prepareNotificationCategories(locale: AppLocale): Promise<void> {
  const messages = messagesFor(locale);
  await Notifications.setNotificationChannelAsync("okorema-alarm", {
    name: "Okorema!",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 180, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: "default",
  });
  await Notifications.setNotificationCategoryAsync("okorema-actions", [
    { identifier: "complete", buttonTitle: messages.done, options: { opensAppToForeground: false } },
    { identifier: "snooze", buttonTitle: messages.snooze10, options: { opensAppToForeground: false } },
  ]);
}

export async function refreshSchedules(repo: Repository, locale: AppLocale, isPro: boolean): Promise<BudgetReport> {
  const [reminders, states, logs] = await Promise.all([repo.reminders(), repo.escalation(), repo.logs()]);
  const now = new Date();
  const visible = reminders.filter((reminder) => !reminder.deletedAt);
  const scheduleInputs: ScheduleReminder[] = visible.map((reminder) => ({
    id: reminder.id,
    title: reminder.title,
    dueAt: reminder.dueAt,
    preNotifyMinutes: reminder.preNotifyMinutes,
    persistence: effectivePersistence(reminder.persistence, isPro),
    completedAt: reminder.completedAt,
    snoozeUntil: reminder.snoozeUntil,
    deletedAt: reminder.deletedAt,
    occurrenceKey: reminder.occurrenceKey,
  }));
  const limit = Platform.OS === "ios" ? IOS_PENDING_NOTIFICATION_LIMIT : ANDROID_ALARM_BUDGET;
  const plan = planNotifications(scheduleInputs, states, now, limit);
  await repo.saveEscalation(plan.states);
  await publishNotifications(plan.notifications, locale);
  await publishSurfaces(visible, logs, locale, now);
  return plan.report;
}

async function publishNotifications(
  notifications: { reminderId: string; identifier: string; kind: "escalation" | "prenotify"; index: number; fireAt: string; occurrenceKey: string; persistence: "gentle" | "normal" | "oni"; title: string; preNotifyMinutes: number | null }[],
  locale: AppLocale,
): Promise<void> {
  const messages = messagesFor(locale);
  if (Platform.OS === "android") {
    const native = getOkoremaNative();
    const alarms = notifications.map((notification) => {
      const copy =
        notification.kind === "prenotify"
          ? preNotifyCopy(notification.title, notification.preNotifyMinutes ?? 5, locale)
          : escalationCopy(notification.persistence, notification.index, notification.title, locale);
      return {
        id: notification.identifier,
        reminderId: notification.reminderId,
        occurrenceKey: notification.occurrenceKey,
        title: copy.title,
        body: copy.body,
        fireAt: new Date(notification.fireAt).getTime(),
        fullScreen: notification.kind === "escalation",
        completeLabel: messages.done,
        snoozeLabel: messages.snooze10,
      };
    });
    native?.syncAlarms(JSON.stringify(alarms));
    return;
  }

  if (Platform.OS !== "ios") {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith("esc:") || item.identifier.startsWith("pre:"))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  for (const notification of notifications) {
    const copy =
      notification.kind === "prenotify"
        ? preNotifyCopy(notification.title, notification.preNotifyMinutes ?? 5, locale)
        : escalationCopy(notification.persistence, notification.index, notification.title, locale);
    const fireAt = new Date(notification.fireAt);
    if (fireAt.getTime() <= Date.now()) {
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: notification.identifier,
      content: {
        title: copy.title,
        body: copy.body,
        categoryIdentifier: "okorema-actions",
        interruptionLevel: "timeSensitive",
        sound: "default",
        data: {
          reminderId: notification.reminderId,
          occurrenceKey: notification.occurrenceKey,
          index: notification.index,
          kind: notification.kind,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: "okorema-alarm",
      },
    });
  }
}

async function publishSurfaces(reminders: Reminder[], logs: CompletionLog[], locale: AppLocale, now: Date): Promise<void> {
  const messages = messagesFor(locale);
  const snapshot = buildWidgetSnapshot(
    reminders,
    logs,
    now,
    {
      noUpcoming: messages.noUpcoming,
      overdue: messages.overdueCount,
      week: messages.weekCompleted,
    },
    (iso) => formatDue(iso, locale, now),
  );
  const native = getOkoremaNative();
  native?.setWidgetSnapshot(JSON.stringify(snapshot));
  const next = upcomingReminders(reminders, now, 1)[0];
  const due = next ? effectiveDueIso(next) : null;
  if (Platform.OS === "android") {
    if (next && due && new Date(due).getTime() > now.getTime()) {
      native?.showCountdown(next.title, new Date(due).getTime());
    } else {
      native?.hideCountdown();
    }
  }
  if (Platform.OS === "ios") {
    const surfaces = await import("@/services/surfaces.ios");
    await surfaces.pushIosSurfaces({
      snapshot,
      title: next?.title ?? messages.noUpcoming,
      dueLabel: due ? formatDue(due, locale, now) : messages.noUpcoming,
      dueAt: due,
    });
  }
}

export async function noteDelivered(repo: Repository, reminderId: string, index: number, locale: AppLocale, isPro: boolean): Promise<void> {
  if (!index) {
    return;
  }
  const states = await repo.escalation();
  const current = states.find((state) => state.reminderId === reminderId);
  if (!current) {
    return;
  }
  const next = markDelivered(current, index);
  if (next.nextIndex === current.nextIndex) {
    return;
  }
  await repo.saveEscalation(states.map((state) => (state.reminderId === reminderId ? next : state)));
  await refreshSchedules(repo, locale, isPro);
}

export async function readNativeActions(): Promise<NativeAction[]> {
  const native = getOkoremaNative();
  if (!native) {
    return [];
  }
  try {
    const raw = native.consumePendingActions();
    const parsed = JSON.parse(raw) as NativeAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function notificationPermissionGranted(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export function androidAlarmStatus(): { exact: boolean; fullScreen: boolean } {
  const native = getOkoremaNative();
  if (!native || Platform.OS !== "android") {
    return { exact: true, fullScreen: true };
  }
  return {
    exact: native.canScheduleExactAlarms(),
    fullScreen: native.canUseFullScreenIntent(),
  };
}

export function openExactAlarmSettings(): void {
  getOkoremaNative()?.openExactAlarmSettings();
}

export function openFullScreenSettings(): void {
  getOkoremaNative()?.openFullScreenIntentSettings();
}

export type { EscalationState };
