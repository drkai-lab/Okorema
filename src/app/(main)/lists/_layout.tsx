import { Stack } from "expo-router";

import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";

export default function ListsLayout() {
  const app = useApp();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" options={{ title: app.messages.lists }} />
      <Stack.Screen name="[id]" options={{ title: app.messages.list }} />
    </Stack>
  );
}
