import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useApp } from "@/state/store";
import { colors, space } from "@/ui/theme";
import { Button, Screen, Seal } from "@/ui/ui";

export default function Onboarding() {
  const app = useApp();
  const [page, setPage] = useState(0);
  const pages = [
    { title: app.messages.onboarding1Title, body: app.messages.onboarding1Body },
    { title: app.messages.onboarding2Title, body: app.messages.onboarding2Body },
    { title: app.messages.onboarding3Title, body: app.messages.onboarding3Body },
  ];
  const current = pages[page];
  const last = page === pages.length - 1;

  async function finish() {
    await app.setFlag("onboarded", "1");
    router.replace("/(main)");
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: space.lg }}>
        <View style={{ gap: space.lg }}>
          <Seal size={88} />
          <Text style={{ color: colors.persimmon, fontWeight: "700" }}>{app.messages.appName}</Text>
          <Text style={{ fontSize: 34, lineHeight: 40, fontWeight: "700", color: colors.ink }}>{current.title}</Text>
          <Text style={{ fontSize: 18, lineHeight: 28, color: colors.inkSoft }}>{current.body}</Text>
          <Text style={{ color: colors.inkSoft }}>
            {page + 1} / {pages.length}
          </Text>
        </View>
        <View style={{ gap: space.sm }}>
          {last ? (
            <Button label={app.messages.start} onPress={() => void finish()} />
          ) : (
            <Button label={app.messages.next} onPress={() => setPage((value) => value + 1)} />
          )}
          {!last ? <Button label={app.messages.skip} tone="quiet" onPress={() => void finish()} /> : null}
        </View>
      </View>
    </Screen>
  );
}
