import { Text } from "react-native";

import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Button, Card, H1, Lead, Screen } from "@/ui/ui";

export default function ProScreen() {
  const app = useApp();
  return (
    <Screen>
      <H1>{app.messages.pro}</H1>
      <Lead>{app.messages.proLead}</Lead>
      <Text style={{ color: colors.inkSoft }}>{app.messages.proPriceNote}</Text>
      {app.isPro ? <Card><Text style={{ color: colors.ok, fontWeight: "700" }}>{app.messages.proUnlocked}</Text></Card> : null}
      <Button label={app.messages.purchase} onPress={() => void app.buyPro()} disabled={app.busy} />
      <Button label={app.messages.restore} tone="secondary" onPress={() => void app.restorePro()} disabled={app.busy} />
      {__DEV__ ? <Button label={app.messages.proDev} tone="quiet" onPress={() => void app.toggleDevPro()} /> : null}
      <Text style={{ color: colors.inkSoft }}>{app.messages.oniHint}</Text>
      <Text style={{ color: colors.inkSoft }}>{app.messages.geofenceLocked}</Text>
      {app.notice ? <Text style={{ color: colors.ink }}>{app.notice}</Text> : null}
    </Screen>
  );
}
