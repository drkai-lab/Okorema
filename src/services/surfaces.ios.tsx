import { addUserInteractionListener, createLiveActivity, createWidget } from "expo-widgets";
import { Button, HStack, Text, VStack } from "@expo/ui/swift-ui";

import type { WidgetSnapshot } from "@/domain/snapshot";

type WidgetProps = WidgetSnapshot;

const HomeWidget = (props: WidgetProps) => {
  "widget";
  const today = props.today ?? [];
  return (
    <VStack>
      <Text>Okorema!</Text>
      <Text>{props.nextTitle}</Text>
      <Text>{props.nextDue}</Text>
      <Text>{props.counts}</Text>
      {today.map((item) => (
        <HStack key={item.id}>
          <Text>{item.done ? `✓ ${item.title}` : item.title}</Text>
          <Button
            label="OK"
            target={`${item.id}::${item.occurrenceKey}`}
            onPress={(() => ({
              ...props,
              today: today.map((row) => (row.id === item.id ? { ...row, done: true } : row)),
            })) as unknown as () => void}
          />
        </HStack>
      ))}
    </VStack>
  );
};

const widget = createWidget<WidgetProps>("OkoremaHome", HomeWidget);

type ActivityProps = {
  title: string;
  dueLabel: string;
};

const NextActivity = (props: ActivityProps) => {
  "widget";
  return {
    banner: (
      <VStack>
        <Text>Okorema!</Text>
        <Text>{props.title}</Text>
        <Text>{props.dueLabel}</Text>
      </VStack>
    ),
    compactLeading: <Text>Ok</Text>,
    compactTrailing: <Text>{props.dueLabel}</Text>,
    minimal: <Text>Ok</Text>,
    expandedLeading: <Text>Okorema!</Text>,
    expandedTrailing: <Text>{props.dueLabel}</Text>,
    expandedBottom: <Text>{props.title}</Text>,
  };
};

const activity = createLiveActivity<ActivityProps>("OkoremaNext", NextActivity);
let currentId: string | null = null;

export async function pushIosSurfaces(input: {
  snapshot: WidgetSnapshot;
  title: string;
  dueLabel: string;
  dueAt: string | null;
}): Promise<void> {
  widget.updateSnapshot(input.snapshot);
  const props = { title: input.title, dueLabel: input.dueLabel };
  const staleDate = input.dueAt ? new Date(input.dueAt) : undefined;
  const existing = activity.getInstances();
  if (existing.length === 0) {
    const started = activity.start(props, "okorema://", staleDate);
    currentId = started.getId();
    return;
  }
  const instance = existing.find((item) => item.getId() === currentId) ?? existing[0];
  currentId = instance.getId();
  await instance.update(props, staleDate);
}

export function listenForWidgetCompletions(onComplete: (reminderId: string, occurrenceKey: string) => void): () => void {
  const subscription = addUserInteractionListener((event) => {
    if (event.source !== "OkoremaHome" || !event.target) {
      return;
    }
    const [reminderId, occurrenceKey] = event.target.split("::");
    if (reminderId && occurrenceKey) {
      onComplete(reminderId, occurrenceKey);
    }
  });
  return () => subscription.remove();
}
