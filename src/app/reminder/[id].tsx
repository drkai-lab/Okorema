import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";
import { Modal, Platform, Pressable, Share, Text, TextInput, View } from "react-native";

import { GEOFENCE_RADII, PRE_NOTIFY_OPTIONS, freshClocks, occurrenceKeyFor, type Geofence, type PersistenceLevel, type Reminder, type RepeatRule } from "@/domain/types";
import { formatDue } from "@/i18n";
import { isExpoGo } from "@/runtime/expoGo";
import { currentCoordinates, searchPlaces, type PlaceHit } from "@/services/places";
import { createId, useApp } from "@/state/store";
import { colors, space } from "@/ui/theme";
import { Button, Chip, FieldLabel, Lead, Screen } from "@/ui/ui";

const REPEATS: RepeatRule[] = ["none", "daily", "weekdays", "weekly", "monthly"];
const LEVELS: PersistenceLevel[] = ["gentle", "normal", "oni"];

export default function ReminderEditor() {
  const app = useApp();
  const params = useLocalSearchParams<{ id: string; listId?: string }>();
  const listParam = typeof params.listId === "string" ? params.listId : "";
  const existing = params.id === "new" ? undefined : app.reminders.find((reminder) => reminder.id === params.id);
  if (params.id !== "new" && !existing) {
    return (
      <Screen>
        <Lead>{app.messages.loadError}</Lead>
      </Screen>
    );
  }
  return <ReminderForm key={existing?.id ?? `new-${listParam}`} existing={existing} initialListId={listParam} />;
}

function ReminderForm({ existing, initialListId }: { existing?: Reminder; initialListId: string }) {
  const app = useApp();
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ title: existing?.title || app.messages.addReminder });
  }, [app.messages.addReminder, existing?.title, navigation]);
  const lists = app.lists.filter((list) => !list.deletedAt);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [listId, setListId] = useState(existing?.listId || initialListId || lists[0]?.id || "");
  const [newListName, setNewListName] = useState("");
  const [due, setDue] = useState<Date | null>(existing?.dueAt ? new Date(existing.dueAt) : null);
  const [showPicker, setShowPicker] = useState(false);
  const [pre, setPre] = useState<number | null>(existing?.preNotifyMinutes ?? null);
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeatRule ?? "none");
  const [persistence, setPersistence] = useState<PersistenceLevel>(existing?.persistence ?? "gentle");
  const [geofence, setGeofence] = useState<Geofence | null>(existing?.geofence ?? null);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [error, setError] = useState("");
  const [ask, setAsk] = useState(false);

  const repeatLabel: Record<RepeatRule, string> = {
    none: app.messages.repeatNone,
    daily: app.messages.repeatDaily,
    weekdays: app.messages.repeatWeekdays,
    weekly: app.messages.repeatWeekly,
    monthly: app.messages.repeatMonthly,
  };
  const levelLabel: Record<PersistenceLevel, string> = {
    gentle: app.messages.gentle,
    normal: app.messages.normal,
    oni: app.messages.oni,
  };

  async function persist() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(app.messages.requiredTitle);
      return;
    }
    let targetList = listId;
    if (!targetList) {
      const name = newListName.trim() || app.messages.shopping;
      const now = new Date().toISOString();
      targetList = createId();
      await app.saveList({
        id: targetList,
        name,
        color: "persimmon",
        icon: "cart",
        sortOrder: lists.length,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        nameClock: now,
      });
    }
    const now = new Date().toISOString();
    const id = existing?.id ?? createId();
    const dueAt = due ? due.toISOString() : null;
    const repeatChanged = existing ? existing.repeatRule !== repeat : true;
    const dueChanged = existing ? existing.dueAt !== dueAt : true;
    const baseClocks = existing?.clocks ?? freshClocks(now);
    const clocks = {
      title: !existing || existing.title !== trimmed ? now : baseClocks.title,
      notes: !existing || existing.notes !== notes ? now : baseClocks.notes,
      dueAt: dueChanged ? now : baseClocks.dueAt,
      completed: baseClocks.completed,
      listId: !existing || existing.listId !== targetList ? now : baseClocks.listId,
    };
    await app.saveReminder({
      id,
      listId: targetList,
      title: trimmed,
      notes,
      dueAt,
      preNotifyMinutes: pre,
      repeatRule: repeat,
      repeatAnchorAt: repeat === "none" ? null : dueChanged || repeatChanged ? dueAt : existing?.repeatAnchorAt ?? dueAt,
      persistence,
      completedAt: existing?.completedAt ?? null,
      snoozeUntil: dueChanged ? null : existing?.snoozeUntil ?? null,
      occurrenceKey: dueChanged || !existing ? occurrenceKeyFor(id, dueAt) : existing.occurrenceKey,
      lastMutationId: existing?.lastMutationId ?? null,
      undoSnapshot: existing?.undoSnapshot ?? null,
      geofence: app.isPro ? geofence : existing?.geofence ?? null,
      externalRecurrence: repeatChanged ? null : existing?.externalRecurrence ?? null,
      clocks,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    });
    router.back();
  }

  async function onSave() {
    if (!title.trim()) {
      setError(app.messages.requiredTitle);
      return;
    }
    const needsAsk = Boolean(due) && app.settings.notifAsked !== "1" && !app.notifGranted;
    if (needsAsk) {
      setAsk(true);
      return;
    }
    await persist();
  }

  async function findPlaces() {
    setSearching(true);
    setPlaceError("");
    try {
      const origin = await currentCoordinates();
      if (!origin) {
        setPlaceError(app.messages.locationNeeded);
        return;
      }
      const hits = await searchPlaces(query.trim() || "station", origin);
      setPlaces(hits);
      if (hits.length === 0) {
        setPlaceError(app.messages.noPlaces);
      }
    } catch {
      setPlaceError(app.messages.noPlaces);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Screen>
      <Lead>{app.messages.editorLead}</Lead>
      <FieldLabel>{app.messages.title}</FieldLabel>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={app.messages.reminderTitlePlaceholder}
        accessibilityLabel={app.messages.title}
        style={input}
      />
      <FieldLabel>{app.messages.notes}</FieldLabel>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={app.messages.notes}
        accessibilityLabel={app.messages.notes}
        multiline
        style={[input, { minHeight: 80 }]}
      />
      <FieldLabel>{app.messages.list}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {lists.map((list) => (
          <Chip key={list.id} label={list.name} selected={listId === list.id} onPress={() => setListId(list.id)} />
        ))}
      </View>
      {lists.length === 0 ? (
        <TextInput
          value={newListName}
          onChangeText={setNewListName}
          placeholder={app.messages.createListInline}
          accessibilityLabel={app.messages.listName}
          style={input}
        />
      ) : null}
      <FieldLabel>{app.messages.due}</FieldLabel>
      <Text style={{ color: colors.ink }}>{due ? formatDue(due.toISOString(), app.locale, app.now) : app.messages.noDue}</Text>
      {Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={app.messages.due}
          value={due ? toLocalInput(due) : ""}
          placeholder="2026-10-08T09:30"
          onChangeText={(value) => {
            const parsed = new Date(value);
            setDue(Number.isNaN(parsed.getTime()) ? null : parsed);
          }}
          style={input}
        />
      ) : (
        <>
          <Button label={due ? app.messages.due : app.messages.due} tone="secondary" onPress={() => setShowPicker(true)} />
          {showPicker ? (
            <DateTimePicker
              value={due ?? nextHour()}
              mode="datetime"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(event, selected) => {
                if (Platform.OS !== "ios") {
                  setShowPicker(false);
                }
                if (event.type === "set" && selected) {
                  setDue(selected);
                }
              }}
            />
          ) : null}
        </>
      )}
      {due ? <Button label={app.messages.clearDue} tone="quiet" onPress={() => setDue(null)} /> : null}
      <FieldLabel>{app.messages.preNotify}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip label={app.messages.preNotifyOff} selected={pre == null} onPress={() => setPre(null)} />
        {PRE_NOTIFY_OPTIONS.map((minutes) => (
          <Chip key={minutes} label={app.messages.minutesBefore(minutes)} selected={pre === minutes} onPress={() => setPre(minutes)} />
        ))}
      </View>
      <FieldLabel>{app.messages.repeat}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REPEATS.map((rule) => (
          <Chip key={rule} label={repeatLabel[rule]} selected={repeat === rule} onPress={() => setRepeat(rule)} />
        ))}
      </View>
      <FieldLabel>{app.messages.persistence}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {LEVELS.map((level) => (
          <Chip
            key={level}
            label={levelLabel[level]}
            selected={persistence === level}
            onPress={() => {
              if (level === "oni" && !app.isPro) {
                setError(app.messages.persistenceProOnly);
                return;
              }
              setPersistence(level);
              setError("");
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors.inkSoft }}>
        {persistence === "oni" ? app.messages.oniHint : persistence === "normal" ? app.messages.normalHint : app.messages.gentleHint}
      </Text>
      {!app.isPro && persistence === "oni" ? <Text style={{ color: colors.persimmon }}>{app.messages.oniLocked}</Text> : null}
      <FieldLabel>{app.messages.geofence}</FieldLabel>
      {app.isPro ? (
        <View style={{ gap: space.sm }}>
          {geofence ? <Text style={{ color: colors.ink }}>{geofence.label}</Text> : <Text style={{ color: colors.inkSoft }}>{app.messages.noneYet}</Text>}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label={app.messages.arrive} selected={geofence?.trigger === "arrive"} onPress={() => geofence && setGeofence({ ...geofence, trigger: "arrive" })} />
            <Chip label={app.messages.leave} selected={geofence?.trigger === "leave"} onPress={() => geofence && setGeofence({ ...geofence, trigger: "leave" })} />
            {GEOFENCE_RADII.map((radius) => (
              <Chip
                key={radius}
                label={app.messages.radiusMeters(radius)}
                selected={geofence?.radiusMeters === radius}
                onPress={() => geofence && setGeofence({ ...geofence, radiusMeters: radius })}
              />
            ))}
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={app.messages.placePlaceholder}
            accessibilityLabel={app.messages.placeSearch}
            style={input}
          />
          <Button label={searching ? app.messages.searching : app.messages.placeSearch} tone="secondary" onPress={() => void findPlaces()} />
          {placeError ? <Text style={{ color: colors.danger }}>{placeError}</Text> : null}
          {places.map((place) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={place.label}
              onPress={() =>
                setGeofence({
                  label: place.label,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  radiusMeters: geofence?.radiusMeters ?? 300,
                  trigger: geofence?.trigger ?? "arrive",
                })
              }
            >
              <Text style={{ color: colors.ink }}>{place.label}</Text>
              <Text style={{ color: colors.inkSoft }}>{app.messages.placeDistance(place.distanceKm)}</Text>
            </Pressable>
          ))}
          {geofence ? <Button label={app.messages.clearDue} tone="quiet" onPress={() => setGeofence(null)} /> : null}
          {isExpoGo() ? <Text style={{ color: colors.inkSoft }}>{app.messages.expoGoGeofence}</Text> : null}
        </View>
      ) : (
        <Text style={{ color: colors.inkSoft }}>{app.messages.geofenceLocked}</Text>
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label={app.messages.save} onPress={() => void onSave()} disabled={app.busy} />
      {existing && (Platform.OS === "android" || isExpoGo()) ? (
        <Button
          label={app.messages.shareToKeep}
          tone="secondary"
          onPress={() => {
            void Share.share({ title, message: `${title}\n${notes}` });
          }}
        />
      ) : null}
      {existing ? (
        <Button
          label={app.messages.delete}
          tone="danger"
          onPress={() => {
            void app.deleteReminder(existing.id);
            router.back();
          }}
        />
      ) : null}
      <Modal visible={ask} transparent animationType="fade" onRequestClose={() => setAsk(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(36,28,22,0.45)", padding: space.md }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: space.lg, gap: space.md }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.ink }}>{app.messages.permissionTitle}</Text>
            <Text style={{ color: colors.inkSoft, fontSize: 16, lineHeight: 24 }}>{app.messages.permissionBody}</Text>
            <Button
              label={app.messages.allow}
              onPress={() => {
                setAsk(false);
                void app.allowNotifications().finally(() => void persist());
              }}
            />
            <Button
              label={app.messages.later}
              tone="secondary"
              onPress={() => {
                setAsk(false);
                void app.markNotifAsked().finally(() => void persist());
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function nextHour(): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const input = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 14,
  padding: space.md,
  fontSize: 18,
  color: colors.ink,
};
