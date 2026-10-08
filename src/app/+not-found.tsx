import { router } from "expo-router";

import { useApp } from "@/state/store";
import { Button, Screen } from "@/ui/ui";

export default function NotFound() {
  const app = useApp();
  return (
    <Screen>
      <Button label={app.messages.home} onPress={() => router.replace("/(main)")} />
    </Screen>
  );
}
