import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { LIST_COLORS, LIST_ICONS } from "@/domain/appearance";
import { createId, useApp } from "@/state/store";
import { colors, space } from "@/ui/theme";
import { Button, FieldLabel, Screen } from "@/ui/ui";

export default function ListForm() {
  const app = useApp();
  const params = useLocalSearchParams<{ id: string }>();
  const existing = app.lists.find((list) => list.id === params.id);
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? LIST_COLORS[0].id);
  const [icon, setIcon] = useState(existing?.icon ?? LIST_ICONS[0].id);
  const [error, setError] = useState("");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(app.messages.requiredTitle);
      return;
    }
    const now = new Date().toISOString();
    await app.saveList({
      id: existing?.id ?? createId(),
      name: trimmed,
      color,
      icon,
      sortOrder: existing?.sortOrder ?? app.lists.filter((list) => !list.deletedAt).length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      nameClock: trimmed === existing?.name ? existing.nameClock : now,
    });
    router.back();
  }

  return (
    <Screen>
      <FieldLabel>{app.messages.listName}</FieldLabel>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={app.messages.listName}
        accessibilityLabel={app.messages.listName}
        style={input}
      />
      <FieldLabel>{app.messages.color}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {LIST_COLORS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.id}
            accessibilityState={{ selected: color === item.id }}
            onPress={() => setColor(item.id)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: item.hex,
              borderWidth: color === item.id ? 3 : 0,
              borderColor: colors.ink,
            }}
          />
        ))}
      </View>
      <FieldLabel>{app.messages.icon}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {LIST_ICONS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.id}
            accessibilityState={{ selected: icon === item.id }}
            onPress={() => setIcon(item.id)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: icon === item.id ? colors.ink : colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <MaterialCommunityIcons name={item.glyph as "cart-outline"} color={icon === item.id ? colors.white : colors.ink} size={22} />
          </Pressable>
        ))}
      </View>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label={app.messages.save} onPress={() => void save()} disabled={app.busy} />
      {existing ? (
        <Button
          label={app.messages.delete}
          tone="danger"
          onPress={() => {
            void app.deleteList(existing.id);
            router.back();
          }}
        />
      ) : null}
      <Text style={{ color: colors.inkSoft }}>{app.messages.deleteListBody}</Text>
    </Screen>
  );
}

const input = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 14,
  padding: space.md,
  fontSize: 18,
  color: colors.ink,
};
