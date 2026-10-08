import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";

import { GOOGLE_SCOPES, addGoogleScope, listGoogleCalendars } from "@/services/sync";
import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { Banner, Button, Card, Lead, Screen } from "@/ui/ui";

export default function SyncScreen() {
  const app = useApp();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);
  const keepStatus = app.settings.keepStatus ?? "";
  const email = app.account?.email ?? "";
  const calendarOn = app.settings.syncCalendar === "1";

  useEffect(() => {
    if (!email || !calendarOn) {
      return;
    }
    let cancelled = false;
    void listGoogleCalendars()
      .then((rows) => {
        if (!cancelled) {
          setCalendars(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalendars([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [calendarOn, email]);

  async function enable(scope: string, key: string, value: boolean) {
    if (value) {
      try {
        await addGoogleScope(scope);
      } catch (cause) {
        setWarnings([cause instanceof Error && cause.message === "missing-google-config" ? app.messages.missingGoogleConfig : app.messages.syncFailed]);
        return;
      }
    }
    await app.setFlag(key, value ? "1" : "0");
  }

  return (
    <Screen>
      <Lead>{app.messages.syncLead}</Lead>
      {!app.account ? <Button label={app.messages.signIn} onPress={() => void app.signIn()} disabled={app.busy} /> : null}
      {app.account ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.signedInAs(app.account.email)}</Text>
          <Text style={{ color: colors.inkSoft }}>{app.account.hostedDomain ? app.messages.keepWorking : app.messages.keepPersonal}</Text>
          <Button label={app.messages.signOut} tone="secondary" onPress={() => void app.signOut()} />
        </Card>
      ) : null}
      <ToggleRow
        label={app.messages.googleCalendar}
        value={app.settings.syncCalendar === "1"}
        disabled={!app.account || app.busy}
        onChange={(value) => void enable(GOOGLE_SCOPES.calendar, "syncCalendar", value)}
      />
      <ToggleRow
        label={app.messages.googleTasks}
        value={app.settings.syncTasks === "1"}
        disabled={!app.account || app.busy}
        onChange={(value) => void enable(GOOGLE_SCOPES.tasks, "syncTasks", value)}
      />
      <ToggleRow
        label={app.messages.googleKeep}
        value={app.settings.syncKeep === "1"}
        disabled={!app.account || app.busy}
        onChange={(value) => void enable(GOOGLE_SCOPES.keep, "syncKeep", value)}
      />
      <Banner>{app.messages.tasksLimitation}</Banner>
      <Banner>{app.messages.keepWorkspace}</Banner>
      {keepStatus === "personal" ? <Banner>{app.messages.keepPersonal}</Banner> : null}
      {keepStatus === "unavailable" ? <Banner>{app.messages.keepWorkspace}</Banner> : null}
      {keepStatus === "eligible" ? <Banner>{app.messages.keepWorking}</Banner> : null}
      {app.settings.syncCalendar === "1" ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.chooseCalendar}</Text>
          <Text style={{ color: colors.inkSoft }}>{app.settings.calendarSummary || app.messages.noneYet}</Text>
          {calendars.map((calendar) => (
            <Button
              key={calendar.id}
              label={calendar.summary}
              tone={calendar.id === app.settings.calendarId ? "primary" : "secondary"}
              onPress={() => {
                void app.setFlag("calendarId", calendar.id);
                void app.setFlag("calendarSummary", calendar.summary);
              }}
            />
          ))}
          <Button label={app.messages.dedicatedCalendar} tone="secondary" onPress={() => void app.makeCalendar()} />
        </Card>
      ) : null}
      <Button
        label={app.busy ? app.messages.syncing : app.messages.syncNow}
        disabled={!app.account || app.busy}
        onPress={() => void app.syncNow().then(setWarnings)}
      />
      <Text style={{ color: colors.inkSoft }}>
        {app.messages.lastSync}: {app.settings.lastSyncAt ? app.settings.lastSyncAt : app.messages.neverSynced}
      </Text>
      {app.settings.lastSyncError ? <Banner>{`${app.messages.syncFailed}: ${app.settings.lastSyncError}`}</Banner> : null}
      {warnings.map((warning) => (
        <Text key={warning} style={{ color: colors.inkSoft }}>{warning}</Text>
      ))}
      <Text style={{ color: colors.inkSoft }}>{app.messages.conflictPolicy}</Text>
      {app.notice ? <Text style={{ color: colors.ink }}>{app.notice}</Text> : null}
    </Screen>
  );
}

function ToggleRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.ink, fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.persimmon, false: colors.line }}
      />
    </View>
  );
}
