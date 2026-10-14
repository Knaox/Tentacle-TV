import type { TrailerOption } from "@tentacle-tv/shared";
import { sheetEntryKey } from "./playerFocus";

/**
 * Les PANNEAUX de la bande-annonce — sous-titres et qualité, les deux seuls
 * choix du lecteur simplifié. Module pur : les modèles d'options (la vue n'y
 * ajoute que les libellés), ce qui rend un bouton présent ou absent,
 * l'entrée d'un panneau ouvert et ce que fait un choix.
 *
 * - Un bouton n'existe que si le serveur sait le servir (capacité
 *   `trailers.player`) ET s'il y a quelque chose à choisir : au moins UNE
 *   langue de sous-titres (« Désactivés » seul n'est pas un choix), au moins
 *   DEUX hauteurs (« Auto » devant une seule hauteur non plus).
 * - Un panneau s'ouvre sur l'option retenue (`sheetEntryKey`, la règle des
 *   feuilles du grand lecteur) ; un choix FERME le panneau et rend le focus au
 *   bouton qui l'a ouvert.
 *
 * Les clés suivent `PlayerSheet` (la feuille du grand lecteur, réutilisée) :
 * pour un panneau `p`, sa croix `p:close`, ses options `p:list:<clé>`.
 */

export type TrailerPanel = "subtitles" | "quality";

/** Le préfixe de clés de chaque panneau (`PlayerSheet`). */
export const TRAILER_PANEL_PREFIX: Readonly<Record<TrailerPanel, string>> = {
  subtitles: "trailerSubtitles",
  quality: "trailerQuality",
};

/** L'unique colonne d'un panneau de la bande-annonce. */
export const TRAILER_PANEL_COLUMN = "list";

/**
 * Les options (« Désactivés », « Auto », pistes, hauteurs) sont communes à
 * tous les lecteurs : `@tentacle-tv/shared` (`trailers/player/trailerChoices.ts`).
 */
export {
  TRAILER_QUALITY_AUTO, TRAILER_SUBTITLES_OFF, trailerQualityHeights, trailerQualityOptions, trailerSubtitleOptions,
} from "@tentacle-tv/shared";
export type { TrailerOption, TrailerSubtitleChoice } from "@tentacle-tv/shared";

/** Ce que le lecteur sait proposer : chaque bouton, présent ou absent. */
export interface TrailerTools {
  subtitles: boolean;
  quality: boolean;
}

/**
 * Les boutons de la bande-annonce. Sans la capacité `trailers.player`
 * (serveur plus ancien), aucun : avancer et reculer restent, sans un mot.
 */
export function trailerTools(input: { playerCapable: boolean; subtitleCount: number; qualityCount: number }): TrailerTools {
  return {
    subtitles: input.playerCapable && input.subtitleCount >= 1,
    quality: input.playerCapable && input.qualityCount >= 2,
  };
}

/** La clé d'une option dans son panneau. */
export function trailerOptionKey(panel: TrailerPanel, optionKey: string): string {
  return `${TRAILER_PANEL_PREFIX[panel]}:${TRAILER_PANEL_COLUMN}:${optionKey}`;
}

/** La croix d'un panneau. */
export function trailerPanelCloseKey(panel: TrailerPanel): string {
  return `${TRAILER_PANEL_PREFIX[panel]}:close`;
}

/** L'entrée d'un panneau ouvert : l'option retenue, sinon la première, sinon sa croix. */
export function trailerPanelEntryKey(panel: TrailerPanel, options: readonly TrailerOption[]): string {
  return sheetEntryKey(TRAILER_PANEL_PREFIX[panel], TRAILER_PANEL_COLUMN, options);
}

/** Ce qu'un choix décide : appliquer (sauf l'option déjà retenue), fermer, et le bouton à refocaliser. */
export interface TrailerChoice {
  panel: TrailerPanel;
  /** La clé choisie, à appliquer ; `null` : c'était déjà elle, rien ne change. */
  apply: string | null;
  close: true;
}

/** Un choix ferme TOUJOURS le panneau ; il ne s'applique que s'il change quelque chose. */
export function trailerChoose(panel: TrailerPanel, options: readonly TrailerOption[], optionKey: string): TrailerChoice {
  const current = options.find((o) => o.selected)?.key ?? null;
  return { panel, apply: optionKey === current ? null : optionKey, close: true };
}
