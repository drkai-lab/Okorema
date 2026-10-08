import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppProvider, useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { OverdueGate } from "@/ui/OverdueGate";
import { Button, Seal } from "@/ui/ui";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const app = useApp();
  useEffect(() => {
    if (app.ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [app.ready]);

  if (!app.ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Seal />
        <ActivityIndicator color={colors.persimmon} />
        <Text style={{ color: colors.inkSoft }}>{app.messages.loading}</Text>
      </View>
    );
  }

  if (app.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}>{app.messages.loadError}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.error}</Text>
        <Button label={app.messages.retry} onPress={() => void app.refresh()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="reminder/[id]" options={{ presentation: "modal", title: app.messages.addReminder }} />
        <Stack.Screen name="list-form/[id]" options={{ presentation: "modal", title: app.messages.newList }} />
      </Stack>
      <OverdueGate />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
