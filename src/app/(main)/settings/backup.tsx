import { Text } from "react-native";

import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Button, Lead, Screen } from "@/ui/ui";

export default function BackupScreen() {
  const app = useApp();
  return (
    <Screen>
      <Lead>{app.messages.backupLead}</Lead>
      <Button label={app.messages.exportBackup} onPress={() => void app.exportBackup()} disabled={app.busy} />
      <Button label={app.messages.importBackup} tone="secondary" onPress={() => void app.importBackup()} disabled={app.busy} />
      {app.notice ? <Text style={{ color: colors.ink }}>{app.notice}</Text> : null}
    </Screen>
  );
}
