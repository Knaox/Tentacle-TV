import { TextStyle } from "react-native";

export const typography = {
  hero: { fontSize: 28, fontWeight: "800" } as TextStyle,
  title: { fontSize: 22, fontWeight: "800" } as TextStyle,
  subtitle: { fontSize: 18, fontWeight: "700" } as TextStyle,
  body: { fontSize: 15, fontWeight: "400" } as TextStyle,
  bodyBold: { fontSize: 15, fontWeight: "600" } as TextStyle,
  caption: { fontSize: 13, fontWeight: "400" } as TextStyle,
  small: { fontSize: 11, fontWeight: "600" } as TextStyle,
  badge: { fontSize: 10, fontWeight: "700" } as TextStyle,
} as const;
