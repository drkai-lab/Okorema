import { requireNativeModule } from "expo";

export type DeviceReminderItem = {
  title: string;
  notes: string;
  dueAt: string;
  listName: string;
  repeating: boolean;
};

export type DeviceReminderImport = {
  granted: boolean;
  items: DeviceReminderItem[];
};

export type PendingNativeAction = {
  reminderId: string;
  occurrenceKey: string;
  action: "complete" | "snooze";
  at: number;
};

type OkoremaNativeModule = {
  canScheduleExactAlarms: () => boolean;
  openExactAlarmSettings: () => void;
  canUseFullScreenIntent: () => boolean;
  openFullScreenIntentSettings: () => void;
  syncAlarms: (json: string) => void;
  showCountdown: (title: string, fireAtMs: number) => void;
  hideCountdown: () => void;
  setWidgetSnapshot: (json: string) => void;
  consumePendingActions: () => string;
  shareToKeep: (title: string, text: string) => boolean;
  importDeviceReminders: () => Promise<DeviceReminderImport>;
};

export function getOkoremaNative(): OkoremaNativeModule | null {
  try {
    return requireNativeModule<OkoremaNativeModule>("OkoremaNative");
  } catch {
    return null;
  }
}
