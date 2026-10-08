export type ListColor = {
  id: string;
  hex: string;
};

export type ListIcon = {
  id: string;
  /** MaterialCommunityIcons glyph name. */
  glyph: string;
};

export const LIST_COLORS: ListColor[] = [
  { id: "persimmon", hex: "#C4491D" },
  { id: "pine", hex: "#2F6D4F" },
  { id: "sea", hex: "#1F6F8B" },
  { id: "indigo", hex: "#3C4C9B" },
  { id: "plum", hex: "#7A3E6D" },
  { id: "gold", hex: "#C48A12" },
  { id: "clay", hex: "#A15C45" },
  { id: "rose", hex: "#C45B73" },
  { id: "slate", hex: "#4E5A66" },
  { id: "moss", hex: "#6A7F2A" },
  { id: "sky", hex: "#3E86B5" },
  { id: "wine", hex: "#7C2F39" },
  { id: "ink", hex: "#2C333A" },
];

export const LIST_ICONS: ListIcon[] = [
  { id: "cart", glyph: "cart-outline" },
  { id: "briefcase", glyph: "briefcase-outline" },
  { id: "pulse", glyph: "heart-pulse" },
  { id: "book", glyph: "book-open-variant" },
  { id: "home", glyph: "home-outline" },
  { id: "meal", glyph: "silverware-fork-knife" },
  { id: "dumbbell", glyph: "dumbbell" },
  { id: "pill", glyph: "pill" },
  { id: "plane", glyph: "airplane" },
  { id: "gift", glyph: "gift-outline" },
  { id: "paw", glyph: "paw" },
  { id: "school", glyph: "school-outline" },
  { id: "music", glyph: "music-note" },
  { id: "leaf", glyph: "leaf" },
  { id: "wallet", glyph: "wallet-outline" },
  { id: "flag", glyph: "flag-outline" },
];

export function colorById(id: string): ListColor {
  return LIST_COLORS.find((color) => color.id === id) ?? LIST_COLORS[0];
}

export function iconById(id: string): ListIcon {
  return LIST_ICONS.find((icon) => icon.id === id) ?? LIST_ICONS[0];
}
