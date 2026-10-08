import { Redirect } from "expo-router";

import { useApp } from "@/state/store";

export default function Index() {
  const app = useApp();
  if (!app.onboarded) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(main)" />;
}
