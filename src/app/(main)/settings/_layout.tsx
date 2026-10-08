import { Stack } from "expo-router";

import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";

export default function SettingsLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sync" options={{ title: app.messages.sync }} />
      <Stack.Screen name="backup" options={{ title: app.messages.backup }} />
      <Stack.Screen name="pro" options={{ title: app.messages.pro }} />
    </Stack>
  );
}
