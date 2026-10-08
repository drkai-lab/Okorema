import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, space } from "@/ui/theme";

export function Seal({ size = 72 }: { size?: number }) {
  const ring = size * 0.72;
  const dot = size * 0.16;
  const width = Math.max(4, Math.round(size * 0.07));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Okorema!"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: width,
          borderColor: colors.persimmon,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.persimmon }} />
      </View>
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 128 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }]}>{children}</View>
  );
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {body}
      {footer}
    </View>
  );
}

export function H1({ children }: { children: string }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Lead({ children }: { children: string }) {
  return <Text style={styles.lead}>{children}</Text>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

type ButtonTone = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  label,
  tone = "primary",
  onPress,
  disabled,
  accessibilityHint,
}: {
  label: string;
  tone?: ButtonTone;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.primary,
        tone === "secondary" && styles.secondary,
        tone === "quiet" && styles.quiet,
        tone === "danger" && styles.danger,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonLabel, tone !== "primary" && tone !== "danger" && styles.buttonLabelInk]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn, color ? { borderColor: color } : null]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.lead}>{body}</Text>
    </Card>
  );
}

export function Banner({ children }: { children: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.add, { bottom: Math.max(insets.bottom, 10) + 18 }, pressed && styles.pressed]}
    >
      <Text style={styles.addPlus}>+</Text>
    </Pressable>
  );
}

export function RowButton(props: PressableProps & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]} {...rest}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space.md, gap: space.md },
  h1: { fontSize: 34, lineHeight: 40, color: colors.ink, fontWeight: "700" },
  lead: { fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  section: { fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", color: colors.inkSoft, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  primary: { backgroundColor: colors.persimmon },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  quiet: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.72 },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: "700" },
  buttonLabelInk: { color: colors.ink },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { color: colors.ink, fontSize: 15 },
  chipLabelOn: { color: colors.white },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.ink },
  banner: { backgroundColor: "#F6E1D4", borderRadius: 14, padding: space.md },
  bannerText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.inkSoft },
  add: {
    position: "absolute",
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.persimmon,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 6,
  },
  addPlus: { color: colors.white, fontSize: 36, lineHeight: 40, fontWeight: "500" },
  row: { gap: 4 },
});
