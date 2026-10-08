import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { escalationCopy, preNotifyCopy, type AppLocale } from "@/domain/copy";
import { effectivePersistence, IOS_PENDING_NOTIFICATION_LIMIT } from "@/domain/escalation";
import { markDelivered, planNotifications, type BudgetReport, type ScheduleReminder } from "@/domain/schedule";
import type { EscalationState } from "@/domain/types";
import { messagesFor } from "@/i18n";

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
  const [reminders, states] = await Promise.all([repo.reminders(), repo.escalation()]);
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
  return plan.report;
}

async function publishNotifications(
  notifications: { reminderId: string; identifier: string; kind: "escalation" | "prenotify"; index: number; fireAt: string; occurrenceKey: string; persistence: "gentle" | "normal" | "oni"; title: string; preNotifyMinutes: number | null }[],
  locale: AppLocale,
): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
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
  return [];
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
  return { exact: true, fullScreen: true };
}

export function openExactAlarmSettings(): void {
  return;
}

export function openFullScreenSettings(): void {
  return;
}

export type { EscalationState };
