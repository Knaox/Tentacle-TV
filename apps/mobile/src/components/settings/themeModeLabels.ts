import type { ThemeMode } from "@/theme";

/** Le nom de chaque thème (espace `preferences`) : la ligne du profil et ses aperçus. */
export const THEME_MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};
