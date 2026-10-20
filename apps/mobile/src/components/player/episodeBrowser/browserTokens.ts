import { Platform } from "react-native";
import { BRAND } from "@tentacle-tv/shared";

/**
 * La matière et les mots de la liste des épisodes du lecteur. Toujours
 * SOMBRE : elle se pose sur l'image, qui ne suit pas le thème de l'app. Les
 * gris sont ceux des menus d'iOS en apparence sombre (label, secondaryLabel) ;
 * la marque n'apparaît qu'en touches — la jauge d'un épisode entamé, l'épisode
 * en cours. Aucun verre : Android a la même structure, sans rien à retirer.
 */
export const EB = {
  label: "#FFFFFF",
  secondary: "rgba(235, 235, 245, 0.64)",
  tertiary: "rgba(235, 235, 245, 0.40)",
  fill: "rgba(255, 255, 255, 0.08)",
  fillStrong: "rgba(255, 255, 255, 0.14)",
  thumbFallback: "#1C1C20",
  thumbFallbackEdge: "#2A2A30",
  gaugeTrack: "rgba(255, 255, 255, 0.30)",
  /** Le voile d'une image sous du texte. */
  scrim: (alpha: number) => `rgba(0, 0, 0, ${alpha})`,
} as const;

/**
 * Le voile qui monte sous la rangée quand elle se pose sur l'image : déjà dense à la
 * hauteur des onglets (une image claire — un ciel — ne doit pas les avaler),
 * presque noir sous les cartes.
 */
export const ROW_SCRIM = {
  lead: 120,
  colors: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.58)", "rgba(0, 0, 0, 0.86)", "rgba(0, 0, 0, 0.94)"] as [string, string, string, string],
  locations: [0, 0.26, 0.6, 1] as [number, number, number, number],
} as const;

/** La marque, lue au rendu (le thème admin peut la changer). */
export function brandGauge(): [string, string] {
  return [BRAND.violet, BRAND.accent];
}

/** Le rose clair de l'épisode en cours, lisible sur le noir. */
export function brandInk(): string {
  return BRAND.accentLight;
}

/** Les tailles de texte : celles d'iOS (footnote 13, subheadline 15, body 17) ; un cran de moins sur Android. */
export const EB_TYPE = Platform.OS === "ios"
  ? { kicker: 13, title: 15, titleLarge: 17, body: 13, heading: 22, display: 28 }
  : { kicker: 12, title: 15, titleLarge: 16, body: 13, heading: 20, display: 26 };

/** La cible tactile minimale de la plateforme. */
export const EB_HIT = Platform.OS === "ios" ? 44 : 48;
