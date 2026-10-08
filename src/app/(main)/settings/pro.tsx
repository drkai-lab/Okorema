import { Text } from "react-native";

import { isExpoGo } from "@/runtime/expoGo";
import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Banner, Button, Card, H1, Lead, Screen } from "@/ui/ui";

export default function ProScreen() {
  const app = useApp();
  const expoGo = isExpoGo();
  return (
    <Screen>
      <H1>{app.messages.pro}</H1>
      <Lead>{app.messages.proLead}</Lead>
      <Text style={{ color: colors.inkSoft }}>{app.messages.proPriceNote}</Text>
      {expoGo ? <Banner>{app.messages.expoGoPro}</Banner> : null}
      {app.isPro ? <Card><Text style={{ color: colors.ok, fontWeight: "700" }}>{app.messages.proUnlocked}</Text></Card> : null}
      <Button label={app.messages.purchase} onPress={() => void app.buyPro()} disabled={app.busy || expoGo} />
      <Button label={app.messages.restore} tone="secondary" onPress={() => void app.restorePro()} disabled={app.busy || expoGo} />
      {__DEV__ || expoGo ? <Button label={app.messages.proDev} tone="quiet" onPress={() => void app.toggleDevPro()} /> : null}
      <Text style={{ color: colors.inkSoft }}>{app.messages.oniHint}</Text>
      <Text style={{ color: colors.inkSoft }}>{app.messages.geofenceLocked}</Text>
      {app.notice ? <Text style={{ color: colors.ink }}>{app.notice}</Text> : null}
    </Screen>
  );
}
