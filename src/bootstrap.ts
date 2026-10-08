import * as BackgroundTask from "expo-background-task";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { occurrenceKeyFor } from "@/domain/types";
import { deviceLocale } from "@/i18n";
import { GEOFENCE_TASK } from "@/services/places";
import { noteDelivered, readNativeActions } from "@/services/scheduler";
import { syncGoogle } from "@/services/sync";

import {
  commitComplete,
  commitSnooze,
  emitDataChanged,
  enqueue,
  isProFrom,
  openAppRepository,
  reschedule,
} from "@/state/actions";

export const SYNC_TASK = "okorema-sync";

type GeofenceTaskData = {
  eventType: Location.GeofencingEventType;
  region: { identifier: string | null };
};

if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) {
      return;
    }
    const payload = data as GeofenceTaskData;
    await enqueue(async () => {
      const repo = await openAppRepository();
      const reminder = (await repo.reminders()).find((item) => item.id === payload.region.identifier);
      if (!reminder?.geofence || reminder.deletedAt || reminder.completedAt) {
        return;
      }
      const entered = payload.eventType === Location.GeofencingEventType.Enter;
      const left = payload.eventType === Location.GeofencingEventType.Exit;
      const matches =
        (entered && reminder.geofence.trigger === "arrive") || (left && reminder.geofence.trigger === "leave");
      if (!matches) {
        return;
      }
      const now = new Date().toISOString();
      await repo.saveReminder({
        ...reminder,
        dueAt: now,
        snoozeUntil: null,
        occurrenceKey: occurrenceKeyFor(reminder.id, now),
        clocks: { ...reminder.clocks, dueAt: now },
        updatedAt: now,
      });
      const settings = await repo.settings();
      await reschedule(repo, deviceLocale(), isProFrom(settings));
      emitDataChanged();
    });
  });
}

if (!TaskManager.isTaskDefined(SYNC_TASK)) {
  TaskManager.defineTask(SYNC_TASK, async () => {
    try {
      const repo = await openAppRepository();
      const result = await syncGoogle(repo);
      if (result.error) {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
      emitDataChanged();
      const settings = await repo.settings();
      await reschedule(repo, deviceLocale(), isProFrom(settings));
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

function dataString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

Notifications.addNotificationResponseReceivedListener((response) => {
  const action = response.actionIdentifier;
  if (action !== "complete" && action !== "snooze") {
    return;
  }
  const data = response.notification.request.content.data ?? {};
  const reminderId = dataString(data.reminderId);
  const occurrenceKey = dataString(data.occurrenceKey);
  if (!reminderId || !occurrenceKey) {
    return;
  }
  const requestId = `notif:${response.notification.request.identifier}:${action}`;
  void enqueue(async () => {
    const repo = await openAppRepository();
    if (action === "complete") {
      await commitComplete(repo, reminderId, occurrenceKey, requestId);
    } else {
      await commitSnooze(repo, reminderId, occurrenceKey, requestId);
    }
  });
});

Notifications.addNotificationReceivedListener((notification) => {
  const data = notification.request.content.data ?? {};
  const reminderId = dataString(data.reminderId);
  const index = Number(data.index);
  if (!reminderId || !Number.isFinite(index) || index < 1 || data.kind === "prenotify") {
    return;
  }
  void enqueue(async () => {
    const repo = await openAppRepository();
    const settings = await repo.settings();
    await noteDelivered(repo, reminderId, index, deviceLocale(), isProFrom(settings));
    emitDataChanged();
  });
});

export async function consumeNativeActions(): Promise<void> {
  const actions = await readNativeActions();
  if (actions.length === 0) {
    return;
  }
  await enqueue(async () => {
    const repo = await openAppRepository();
    for (const action of actions) {
      const requestId = `native:${action.reminderId}:${action.at}:${action.action}`;
      if (action.action === "complete") {
        await commitComplete(repo, action.reminderId, action.occurrenceKey, requestId);
      } else {
        await commitSnooze(repo, action.reminderId, action.occurrenceKey, requestId);
      }
    }
  });
}

export async function ensureBackgroundSync(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    const defined = TaskManager.isTaskDefined(SYNC_TASK);
    if (!defined) {
      return;
    }
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 });
  } catch {
    // Background task registration is unavailable on simulators and web.
  }
}

export function listenForIosWidgetCompletions(): () => void {
  if (Platform.OS !== "ios") {
    return () => undefined;
  }
  let remove: () => void = () => undefined;
  let cancelled = false;
  void import("@/services/surfaces.ios").then((surfaces) => {
    if (cancelled) {
      return;
    }
    remove = surfaces.listenForWidgetCompletions((reminderId, occurrenceKey) => {
      void enqueue(async () => {
        const repo = await openAppRepository();
        await commitComplete(repo, reminderId, occurrenceKey, `widget:${reminderId}:${occurrenceKey}`);
      });
    });
  });
  return () => {
    cancelled = true;
    remove();
  };
}
