import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colorById, iconById } from "@/domain/appearance";
import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Button, Card, EmptyState, H1, Screen } from "@/ui/ui";

export default function ListsScreen() {
  const app = useApp();
  const lists = app.lists.filter((list) => !list.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <Screen>
      <H1>{app.messages.lists}</H1>
      {lists.length === 0 ? <EmptyState title={app.messages.emptyListsTitle} body={app.messages.emptyListsBody} /> : null}
      {lists.map((list, index) => {
        const count = app.reminders.filter((reminder) => reminder.listId === list.id && !reminder.deletedAt && !reminder.completedAt).length;
        const glyph = iconById(list.icon).glyph;
        return (
          <Card key={list.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={list.name}
              onPress={() => router.push({ pathname: "/(main)/lists/[id]", params: { id: list.id } })}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colorById(list.color).hex, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name={glyph as "cart-outline"} color={colors.white} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{list.name}</Text>
                <Text style={{ color: colors.inkSoft }}>{count}</Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Button label={app.messages.moveUp} tone="secondary" disabled={index === 0} onPress={() => void app.reorderList(list.id, -1)} />
              <Button label={app.messages.moveDown} tone="secondary" disabled={index === lists.length - 1} onPress={() => void app.reorderList(list.id, 1)} />
              <Button label={app.messages.editList} tone="quiet" onPress={() => router.push({ pathname: "/list-form/[id]", params: { id: list.id } })} />
            </View>
          </Card>
        );
      })}
      <Button label={app.messages.newList} onPress={() => router.push({ pathname: "/list-form/[id]", params: { id: "new" } })} />
    </Screen>
  );
}
