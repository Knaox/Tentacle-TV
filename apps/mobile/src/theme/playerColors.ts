/**
 * Tokens du lecteur vidéo — overlay SOMBRE FIXE, non schémé (décision
 * validée : comme YouTube/Netflix, les contrôles restent sombres sur la
 * vidéo quel que soit le thème de l'app, pour la lisibilité).
 *
 * Seul namespace couleur autorisé dans `src/components/player/*` et les
 * écrans lecteur. Les accents suivent la MARQUE via getters (thème admin),
 * pas le scheme. `SubtitleOverlay` reste hors de tout système de tokens
 * (rendu lisibilité vidéo, intouchable).
 */

import { BRAND } from "@tentacle-tv/shared";

interface PlayerColors {
  readonly bg: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly textDim: string;
  /** Contenu (texte/icône) posé sur une surface CLAIRE (ex. bouton blanc). */
  readonly textInverse: string;
  /** Fond des pills/boutons posés sur la vidéo. */
  readonly controlBg: string;
  readonly controlBgHeavy: string;
  /** Voiles de dégradé/scrim au-dessus de la vidéo. */
  readonly scrim: string;
  readonly scrimSoft: string;
  readonly scrimStrong: string;
  readonly border: string;
  readonly borderSubtle: string;
  readonly fillSubtle: string;
  readonly fillSoft: string;
  /** Remplissage sombre translucide sur surface CLAIRE (piste d'anneau). */
  readonly fillInverse: string;
  /** Statuts — rouge erreur (PlayerErrorView) et ambre (chips HDR/Atmos). */
  readonly error: string;
  readonly errorSoft: string;
  readonly warning: string;
  readonly warningSoft: string;
  readonly accent: string;
  readonly accentLight: string;
  readonly accentSoft: string;
  /** Violet clair chip — texte de badge sur fond accentSoft (HDR/DV/Atmos, tracks actifs). Distinct de accentLight (utilisé pour du texte plein). */
  readonly accentChip: string;
}

export const PLAYER: PlayerColors = {
  bg: "#000000",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textTertiary: "rgba(255, 255, 255, 0.5)",
  textDim: "rgba(255, 255, 255, 0.35)",
  textInverse: "#000000",
  controlBg: "rgba(0, 0, 0, 0.6)",
  controlBgHeavy: "rgba(0, 0, 0, 0.9)",
  scrim: "rgba(0, 0, 0, 0.45)",
  scrimSoft: "rgba(0, 0, 0, 0.25)",
  scrimStrong: "rgba(0, 0, 0, 0.72)",
  border: "rgba(255, 255, 255, 0.2)",
  borderSubtle: "rgba(255, 255, 255, 0.1)",
  fillSubtle: "rgba(255, 255, 255, 0.05)",
  fillSoft: "rgba(255, 255, 255, 0.08)",
  fillInverse: "rgba(0, 0, 0, 0.14)",
  error: "#EF4444",
  errorSoft: "rgba(239, 68, 68, 0.15)",
  warning: "#FCD34D",
  warningSoft: "rgba(245, 158, 11, 0.2)",
  get accent(): string {
    return BRAND.violet;
  },
  get accentLight(): string {
    return BRAND.light;
  },
  get accentSoft(): string {
    return BRAND.soft;
  },
  accentChip: "#C4B5FD",
};
