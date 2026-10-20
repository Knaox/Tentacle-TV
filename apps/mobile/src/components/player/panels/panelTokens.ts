import { Platform } from "react-native";

/**
 * La matière et les mots des panneaux du lecteur. Toujours SOMBRES : l'image
 * dessous ne suit pas le thème de l'app. Les valeurs d'iOS sont celles de ses
 * menus (label, secondaryLabel, séparateur, sélection) en apparence sombre ;
 * Android garde la même structure, sur un fond plein, sans verre.
 */
export const PANEL = {
  label: "#FFFFFF",
  secondary: "rgba(235, 235, 245, 0.62)",
  tertiary: "rgba(235, 235, 245, 0.38)",
  separator: "rgba(255, 255, 255, 0.14)",
  /** La bande entre deux sections (le séparateur épais des menus d'iOS). */
  sectionGap: "rgba(0, 0, 0, 0.18)",
  pressed: "rgba(255, 255, 255, 0.12)",
  current: "rgba(255, 255, 255, 0.10)",
  closeFill: "rgba(255, 255, 255, 0.14)",
  /** Le fond d'Android : plein, sans flou (Material ne fait pas de verre). */
  androidSurface: "rgba(28, 28, 32, 0.97)",
  androidBorder: "rgba(255, 255, 255, 0.10)",
  progressTrack: "rgba(255, 255, 255, 0.28)",
  progressFill: "#FFFFFF",
  thumbFallback: "rgba(255, 255, 255, 0.08)",
  /** La teinte du Liquid Glass : assez sombre pour lire du blanc sur une image claire. */
  glassTint: "rgba(18, 18, 22, 0.55)",
} as const;

/** Les tailles de texte d'iOS (body 17, subheadline 15, footnote 13) ; un cran de moins sur Android. */
export const PANEL_TYPE = Platform.OS === "ios"
  ? { title: 17, body: 17, detail: 13, footnote: 13, section: 15 }
  : { title: 18, body: 16, detail: 13, footnote: 13, section: 14 };

/** Hauteur minimale d'une ligne : la cible tactile de la plateforme. */
export const PANEL_ROW_MIN = Platform.OS === "ios" ? 44 : 48;
