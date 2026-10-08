import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDue } from "@/i18n";
import { overdueReminders } from "@/domain/overdue";
import { useApp } from "@/state/store";
import { colors, space } from "@/ui/theme";
import { Button } from "@/ui/ui";

export function OverdueGate() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  if (!app.ready || !app.onboarded) {
    return null;
  }
  const overdue = overdueReminders(
    app.reminders.filter((reminder) => !reminder.deletedAt),
    app.now,
  );
  if (overdue.length === 0) {
    return null;
  }
  const target = overdue.find((reminder) => reminder.id === pendingDelete) ?? null;
  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={[styles.cover, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
        <Text style={styles.kicker}>Okorema!</Text>
        <Text style={styles.title}>{app.messages.overdueTitle}</Text>
        <Text style={styles.body}>{app.messages.overdueBody}</Text>
        {overdue.map((reminder) => (
          <View key={reminder.id} style={styles.card}>
            <Text style={styles.cardTitle}>{reminder.title}</Text>
            <Text style={styles.cardDue}>{formatDue(reminder.snoozeUntil ?? reminder.dueAt, app.locale, app.now)}</Text>
            <View style={styles.actions}>
              <Button label={app.messages.done} onPress={() => void app.complete(reminder)} disabled={app.busy} />
              <Button label={app.messages.snooze10} tone="secondary" onPress={() => void app.snooze(reminder)} disabled={app.busy} />
              <Button label={app.messages.delete} tone="quiet" onPress={() => setPendingDelete(reminder.id)} disabled={app.busy} />
            </View>
          </View>
        ))}
        {overdue.length > 1 ? (
          <Button label={app.messages.snoozeAll} tone="secondary" onPress={() => void app.snoozeAllOverdue()} disabled={app.busy} />
        ) : null}
      <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>{app.messages.deleteConfirmTitle}</Text>
            <Text style={styles.body}>{app.messages.deleteConfirmBody}</Text>
            <Button
              label={app.messages.delete}
              tone="danger"
              onPress={() => {
                if (target) {
                  void app.deleteReminder(target.id);
                }
                setPendingDelete(null);
              }}
            />
            <Button label={app.messages.cancel} tone="secondary" onPress={() => setPendingDelete(null)} />
          </View>
        </View>
      </Modal>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.md, gap: space.md },
  kicker: { color: colors.persimmon, fontWeight: "700", letterSpacing: 0.4 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.ink },
  cardDue: { color: colors.persimmon, fontSize: 15 },
  actions: { gap: space.sm },
  modal: { flex: 1, backgroundColor: "rgba(36,28,22,0.45)", justifyContent: "flex-end", padding: space.md },
  modalCard: { backgroundColor: colors.card, borderRadius: 20, padding: space.lg, gap: space.md },
});
