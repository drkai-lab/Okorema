import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { createBackup, importBackupAdditive } from "@/domain/backup";
import type { Repository } from "@/db/repository";

export async function exportBackupFile(repo: Repository): Promise<void> {
  const [lists, reminders, logs] = await Promise.all([repo.lists(), repo.reminders(), repo.logs()]);
  const backup = createBackup(lists, reminders, logs, new Date().toISOString());
  const file = new File(Paths.cache, "okorema-backup.json");
  if (file.exists) {
    file.delete();
  }
  file.write(JSON.stringify(backup, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json" });
  }
}

export async function importBackupFile(repo: Repository): Promise<{ lists: number; reminders: number } | { error: string }> {
  const picked = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.[0]) {
    return { lists: 0, reminders: 0 };
  }
  const file = new File(picked.assets[0].uri);
  const raw = JSON.parse(await file.text()) as unknown;
  const result = importBackupAdditive(await repo.lists(), await repo.reminders(), await repo.logs(), raw);
  if (!result.ok) {
    return { error: "invalid-backup" };
  }
  await repo.replaceAll(result.lists, result.reminders, result.completionLogs);
  return { lists: result.addedLists, reminders: result.addedReminders };
}
