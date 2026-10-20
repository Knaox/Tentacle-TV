/**
 * Le contenu des deux menus du lecteur, dans l'ordre du lecteur d'Apple :
 *
 * - le bouton des sous-titres ouvre « Audio et sous-titres » — Audio, puis
 *   Sous-titres (« Désactivés » en tête) ;
 * - la roue ouvre « Réglages » — Qualité.
 *
 * L'audio vivait sous la roue, loin des sous-titres : « pas clair » (alpha du
 * 21/10). Une section vide n'est jamais rendue ; un menu vide n'a pas de bouton.
 */
export type PlayerMenu = "tracks" | "settings";
export type PlayerMenuSection = "audio" | "subtitles" | "quality";

export interface PlayerMenuCounts {
  audio: number;
  subtitles: number;
  /** Les paliers de qualité (aucun en lecture locale). */
  quality: number;
}

const ORDER: Record<PlayerMenu, readonly PlayerMenuSection[]> = {
  tracks: ["audio", "subtitles"],
  settings: ["quality"],
};

export function playerMenuSections(menu: PlayerMenu, counts: PlayerMenuCounts): PlayerMenuSection[] {
  return ORDER[menu].filter((section) => counts[section] > 0);
}

/** Les menus qui ont un bouton : ceux qui ont au moins une section. */
export function playerMenusAvailable(counts: PlayerMenuCounts): Record<PlayerMenu, boolean> {
  return {
    tracks: playerMenuSections("tracks", counts).length > 0,
    settings: playerMenuSections("settings", counts).length > 0,
  };
}

/**
 * Le titre de la section n'est dit que s'il y en a plusieurs : un menu à une
 * section porte le nom de cette section en tête du panneau (`menuTitleKey`).
 */
export function showSectionTitles(sections: readonly PlayerMenuSection[]): boolean {
  return sections.length > 1;
}

/** La clé (espace `player`) du titre du panneau. */
export function menuTitleKey(menu: PlayerMenu, sections: readonly PlayerMenuSection[]): string {
  if (sections.length === 1) return `panels.${sections[0]}`;
  return menu === "tracks" ? "panels.tracksTitle" : "panels.settingsTitle";
}
