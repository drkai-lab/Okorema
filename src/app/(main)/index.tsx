import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { colorById } from "@/domain/appearance";
import { completedSince, visibleCompleted } from "@/domain/mutation";
import { effectiveDueIso, overdueReminders, remindersDueToday, upcomingReminders } from "@/domain/overdue";
import { formatDue } from "@/i18n";
import { createId } from "@/db/repository";
import { useApp } from "@/state/store";
import { colors, space } from "@/ui/theme";
import { Banner, Button, Card, EmptyState, H1, Lead, Screen, SectionTitle } from "@/ui/ui";

export default function HomeScreen() {
  const app = useApp();
  const [showAllDone, setShowAllDone] = useState(false);
  const active = app.reminders.filter((reminder) => !reminder.deletedAt);
  const lists = app.lists.filter((list) => !list.deletedAt);
  const upcoming = upcomingReminders(active, app.now, 3);
  const today = remindersDueToday(active, app.now);
  const overdue = overdueReminders(active, app.now);
  const places = active.filter((reminder) => reminder.geofence && !reminder.completedAt && !effectiveDueIso(reminder));
  const done = visibleCompleted(active, app.logs, showAllDone ? 40 : 5);
  const week = completedSince(app.logs, app.now, 7);
  const listName = (id: string) => lists.find((list) => list.id === id)?.name ?? "";

  return (
    <Screen>
      <H1>{app.messages.appName}</H1>
      <Lead>{app.messages.tagline}</Lead>
      <Text style={{ color: colors.inkSoft }}>{app.messages.weekCompleted(week)}</Text>
      {overdue.length > 0 ? <Banner>{app.messages.overdueCount(overdue.length)}</Banner> : null}
      {app.budget?.truncated ? <Banner>{app.messages.budgetWarning(app.budget.scheduledCount, app.budget.desiredCount)}</Banner> : null}
      {app.notice ? (
        <Card>
          <Text style={{ color: colors.ink }}>{app.notice}</Text>
          <Button label={app.messages.close} tone="quiet" onPress={app.clearNotice} />
        </Card>
      ) : null}
      {Platform.OS === "android" && !app.exactAlarm ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.exactAlarmTitle}</Text>
          <Text style={{ color: colors.inkSoft }}>{app.messages.exactAlarmBody}</Text>
          <Button label={app.messages.openSettings} tone="secondary" onPress={app.openExact} />
        </Card>
      ) : null}
      {Platform.OS === "android" && !app.fullScreenIntent ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{app.messages.fullScreenTitle}</Text>
          <Text style={{ color: colors.inkSoft }}>{app.messages.fullScreenBody}</Text>
          <Button label={app.messages.openSettings} tone="secondary" onPress={app.openFullScreen} />
        </Card>
      ) : null}

      <SectionTitle>{app.messages.nextUp}</SectionTitle>
      {upcoming.length === 0 ? <EmptyState title={app.messages.noUpcoming} body={app.messages.emptyHomeBody} /> : null}
      {upcoming.map((reminder) => (
        <ReminderCard key={reminder.id} title={reminder.title} meta={`${listName(reminder.listId)} · ${formatDue(effectiveDueIso(reminder), app.locale, app.now)}`} color={colorById(lists.find((list) => list.id === reminder.listId)?.color ?? "").hex} onOpen={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder.id } })} onDone={() => void app.complete(reminder)} onSnooze={() => void app.snooze(reminder)} doneLabel={app.messages.done} snoozeLabel={app.messages.snooze10} busy={app.busy} />
      ))}

      <SectionTitle>{app.messages.today}</SectionTitle>
      {today.length === 0 ? <Text style={{ color: colors.inkSoft }}>{app.messages.todayEmpty}</Text> : null}
      {today.map((reminder) => (
        <ReminderCard key={`today-${reminder.id}`} title={reminder.title} meta={formatDue(reminder.snoozeUntil ?? reminder.dueAt, app.locale, app.now)} color={colorById(lists.find((list) => list.id === reminder.listId)?.color ?? "").hex} onOpen={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder.id } })} onDone={() => void app.complete(reminder)} onSnooze={() => void app.snooze(reminder)} doneLabel={app.messages.done} snoozeLabel={app.messages.snooze10} busy={app.busy} />
      ))}

      {places.length > 0 ? (
        <>
          <SectionTitle>{app.messages.geofence}</SectionTitle>
          {places.map((reminder) => (
            <ReminderCard key={`place-${reminder.id}`} title={reminder.title} meta={reminder.geofence?.label ?? app.messages.geofence} color={colors.persimmon} onOpen={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder.id } })} onDone={() => void app.complete(reminder)} doneLabel={app.messages.done} busy={app.busy} />
          ))}
        </>
      ) : null}

      <SectionTitle>{app.messages.completed}</SectionTitle>
      {done.length === 0 ? <Text style={{ color: colors.inkSoft }}>{app.messages.completedEmpty}</Text> : null}
      {done.map((item) => (
        <Card key={`${item.id}-${item.completedAt}`}>
          <Text style={{ color: colors.ink, textDecorationLine: "line-through" }}>{item.title}</Text>
          <Text style={{ color: colors.inkSoft }}>{formatDue(item.completedAt, app.locale, app.now)}</Text>
        </Card>
      ))}
      {visibleCompleted(active, app.logs, 6).length > 5 ? (
        <Button label={showAllDone ? app.messages.showLess : app.messages.showMore} tone="secondary" onPress={() => setShowAllDone((value) => !value)} />
      ) : null}

      {active.length === 0 ? (
        <View style={{ gap: space.sm }}>
          <EmptyState title={app.messages.emptyHomeTitle} body={app.messages.emptyHomeBody} />
          {lists.length === 0 ? (
            <Button label={app.messages.suggestedLists} tone="secondary" onPress={() => void createSuggested(app)} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

async function createSuggested(app: ReturnType<typeof useApp>) {
  const now = new Date().toISOString();
  const specs = [
    { name: app.messages.shopping, color: "persimmon", icon: "cart" },
    { name: app.messages.work, color: "sea", icon: "briefcase" },
    { name: app.messages.health, color: "pine", icon: "pulse" },
  ];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    if (app.lists.some((list) => list.name === spec.name && !list.deletedAt)) {
      continue;
    }
    await app.saveList({
      id: createId(),
      name: spec.name,
      color: spec.color,
      icon: spec.icon,
      sortOrder: app.lists.length + index,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      nameClock: now,
    });
  }
}

function ReminderCard({
  title,
  meta,
  color,
  onOpen,
  onDone,
  onSnooze,
  doneLabel,
  snoozeLabel,
  busy,
}: {
  title: string;
  meta: string;
  color: string;
  onOpen: () => void;
  onDone: () => void;
  onSnooze?: () => void;
  doneLabel: string;
  snoozeLabel?: string;
  busy: boolean;
}) {
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onOpen} style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink, flex: 1 }}>{title}</Text>
        </View>
        <Text style={{ color: colors.inkSoft }}>{meta}</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label={doneLabel} onPress={onDone} disabled={busy} />
        {onSnooze && snoozeLabel ? <Button label={snoozeLabel} tone="secondary" onPress={onSnooze} disabled={busy} /> : null}
      </View>
    </Card>
  );
}
