import Constants from "expo-constants";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, Text } from "react-native";

import { isExpoGo } from "@/runtime/expoGo";
import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Banner, Button, Card, H1, Lead, Screen } from "@/ui/ui";

const OWNER_TAPS = 7;

export default function SettingsScreen() {
  const app = useApp();
  const taps = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const devOn = app.settings.proDevUnlock === "1";
  const version = Constants.expoConfig?.version ?? "1.0.0";
  return (
    <Screen>
      <H1>{app.messages.settings}</H1>
      <Lead>{app.messages.settingsLead}</Lead>
      {isExpoGo() ? <Banner>{app.messages.expoGoLimits}</Banner> : null}
      <Card>
        <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.systemStatus}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.notifGranted ? app.messages.notifReady : app.messages.notifMissing}</Text>
        {Platform.OS === "android" ? (
          <>
            <Text style={{ color: colors.inkSoft }}>{app.exactAlarm ? app.messages.exactAlarmReady : app.messages.exactAlarmMissing}</Text>
            <Text style={{ color: colors.inkSoft }}>{app.fullScreenIntent ? app.messages.fullScreenReady : app.messages.fullScreenMissing}</Text>
            {!app.exactAlarm ? <Button label={app.messages.exactAlarmTitle} tone="secondary" onPress={app.openExact} /> : null}
            {!app.fullScreenIntent ? <Button label={app.messages.fullScreenTitle} tone="secondary" onPress={app.openFullScreen} /> : null}
          </>
        ) : null}
        {!app.notifGranted ? <Button label={app.messages.allow} onPress={() => void app.allowNotifications()} /> : null}
        <Text style={{ color: colors.inkSoft }}>{app.messages.notifActions}</Text>
        <Text style={{ color: colors.inkSoft }}>{isExpoGo() ? app.messages.expoGoWidgets : app.messages.liveActivity}</Text>
        <Text style={{ color: colors.inkSoft }}>{isExpoGo() ? app.messages.expoGoWidgets : app.messages.widgetHelp}</Text>
      </Card>
      <Card>
        <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.importDevice}</Text>
        <Text style={{ color: colors.inkSoft }}>
          {isExpoGo() ? app.messages.expoGoImport : Platform.OS === "ios" ? app.messages.importDeviceIos : app.messages.importDeviceAndroid}
        </Text>
        {Platform.OS === "ios" && !isExpoGo() ? <Button label={app.messages.importDevice} tone="secondary" onPress={() => void app.importDevice()} /> : null}
      </Card>
      <Button label={app.messages.backup} tone="secondary" onPress={() => router.push("/(main)/settings/backup")} />
      <Button label={app.messages.sync} tone="secondary" onPress={() => router.push("/(main)/settings/sync")} />
      <Button label={app.messages.pro} tone="secondary" onPress={() => router.push("/(main)/settings/pro")} />
      <Card>
        <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.language}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.messages.languageValue}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.messages.accountFree}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.messages.noAds}</Text>
      </Card>
      <Card>
        <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.about}</Text>
        <Text style={{ color: colors.inkSoft }}>{app.messages.aboutBody}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            taps.current += 1;
            if (taps.current >= OWNER_TAPS) {
              setRevealed(true);
            }
          }}
        >
          <Text style={{ color: colors.inkSoft }}>{app.messages.versionLabel(version)}</Text>
        </Pressable>
      </Card>
      {revealed || devOn ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.ownerProTitle}</Text>
          <Text style={{ color: colors.inkSoft }}>{app.messages.ownerProBody}</Text>
          <Button
            label={devOn ? app.messages.ownerProLock : app.messages.proDev}
            tone="secondary"
            onPress={() => void app.toggleDevPro()}
          />
        </Card>
      ) : null}
      {__DEV__ ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.devSection}</Text>
          <Button label={app.messages.seedDemo} tone="secondary" onPress={() => void app.seed()} />
        </Card>
      ) : null}
      {app.notice ? <Text style={{ color: colors.ink }}>{app.notice}</Text> : null}
    </Screen>
  );
}
