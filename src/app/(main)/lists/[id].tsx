import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colorById } from "@/domain/appearance";
import { formatDue } from "@/i18n";
import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Button, Card, EmptyState, H1, Screen } from "@/ui/ui";

export default function ListDetail() {
  const app = useApp();
  const params = useLocalSearchParams<{ id: string }>();
  const list = app.lists.find((item) => item.id === params.id && !item.deletedAt);
  if (!list) {
    return (
      <Screen>
        <EmptyState title={app.messages.emptyListsTitle} body={app.messages.emptyListBody} />
      </Screen>
    );
  }
  const reminders = app.reminders.filter((reminder) => reminder.listId === list.id && !reminder.deletedAt);
  const open = reminders.filter((reminder) => !reminder.completedAt);
  const done = reminders.filter((reminder) => reminder.completedAt);
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colorById(list.color).hex }} />
        <H1>{list.name}</H1>
      </View>
      {open.length === 0 ? <EmptyState title={app.messages.emptyListTitle} body={app.messages.emptyListBody} /> : null}
      {open.map((reminder) => (
        <Card key={reminder.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={reminder.title} onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder.id } })}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{reminder.title}</Text>
            <Text style={{ color: colors.inkSoft }}>{formatDue(reminder.snoozeUntil ?? reminder.dueAt, app.locale, app.now)}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button label={app.messages.done} disabled={app.busy} onPress={() => void app.complete(reminder)} />
            {reminder.dueAt ? <Button label={app.messages.snooze10} tone="secondary" disabled={app.busy} onPress={() => void app.snooze(reminder)} /> : null}
            {reminder.undoSnapshot ? <Button label={app.messages.undo} tone="quiet" onPress={() => void app.undo(reminder.id)} /> : null}
          </View>
        </Card>
      ))}
      {done.length > 0 ? <Text style={{ fontWeight: "700", color: colors.inkSoft }}>{app.messages.completed}</Text> : null}
      {done.slice(0, 5).map((reminder) => (
        <Card key={reminder.id}>
          <Text style={{ color: colors.ink, textDecorationLine: "line-through" }}>{reminder.title}</Text>
          {reminder.undoSnapshot ? <Button label={app.messages.undo} tone="secondary" onPress={() => void app.undo(reminder.id)} /> : null}
        </Card>
      ))}
      <Button
        label={app.messages.addReminder}
        onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: "new", listId: list.id } })}
      />
    </Screen>
  );
}
