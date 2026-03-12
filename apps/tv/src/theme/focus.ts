export type FocusVariant = "card" | "button" | "row" | "default";

export const FocusSpring = { damping: 18, stiffness: 200 } as const;

export const FocusScale = {
  card: 1.05, button: 1.06, row: 1.0, default: 1.05, normal: 1.0,
} as const;

export const FocusGlow = {
  color: "rgba(139, 92, 246, 0.35)",
  opacity: 0.5,
  shadowColor: "#8B5CF6",
  shadowOpacity: 0.5,
  shadowRadius: 12,
  elevation: 8,
} as const;

export const FocusRowStyle = {
  bgColor: "rgba(139, 92, 246, 0.12)",
  barColor: "#8B5CF6",
  barWidth: 3,
} as const;

export const FocusButtonStyle = {
  bgColor: "rgba(139, 92, 246, 0.18)",
  borderColor: "rgba(139, 92, 246, 0.5)",
  borderWidth: 2,
} as const;
