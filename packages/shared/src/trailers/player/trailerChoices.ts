/**
 * Les CHOIX d'une bande-annonce — sous-titres et qualité —, communs à tous
 * les lecteurs (téléviseurs, web, bureau). Module pur : les modèles
 * d'options (la vue n'y ajoute que les libellés), la qualité au lancement et
 * ce que le lecteur demande au moteur. La disposition des panneaux (focus,
 * clés de la télécommande) reste à chaque plateforme (`trailerPanels`, tv-core).
 */

/** « Désactivés » (sous-titres) et « Auto » (qualité) : la première option. */
export const TRAILER_SUBTITLES_OFF = "off";
export const TRAILER_QUALITY_AUTO = "auto";

export interface TrailerOption {
  /** La clé de l'option : `off`, l'identifiant d'une piste ; `auto`, une hauteur. */
  key: string;
  selected: boolean;
}

/** Une piste de sous-titres proposée par le serveur (la vue en tire le libellé). */
export interface TrailerSubtitleChoice {
  id: string;
}

/** « Désactivés », puis les pistes dans l'ordre du serveur ; `selectedId` nul : désactivés. */
export function trailerSubtitleOptions(tracks: readonly TrailerSubtitleChoice[], selectedId: string | null): TrailerOption[] {
  const known = tracks.some((t) => t.id === selectedId);
  return [
    { key: TRAILER_SUBTITLES_OFF, selected: !known },
    ...tracks.map((t) => ({ key: t.id, selected: t.id === selectedId })),
  ];
}

/** Les hauteurs distinctes et valides, de la plus haute à la plus basse. */
export function trailerQualityHeights(heights: readonly number[]): number[] {
  const valid = heights.filter((h) => Number.isFinite(h) && h > 0).map((h) => Math.round(h));
  return [...new Set(valid)].sort((a, b) => b - a);
}

/** « Auto », puis les hauteurs décroissantes ; `selectedHeight` nul (ou inconnu) : auto. */
export function trailerQualityOptions(heights: readonly number[], selectedHeight: number | null): TrailerOption[] {
  const list = trailerQualityHeights(heights);
  const known = selectedHeight !== null && list.includes(selectedHeight);
  return [
    { key: TRAILER_QUALITY_AUTO, selected: !known },
    ...list.map((h) => ({ key: String(h), selected: known && h === selectedHeight })),
  ];
}

/**
 * Ce que la bande-annonce DEMANDE au moteur : la langue des sous-titres et la
 * hauteur choisies — seulement parmi ce que le flux OFFRE. Un serveur d'avant
 * (sans `trailers.player`) n'offre ni pistes ni paliers : rien n'est demandé
 * (Auto, aucun sous-titre), même si un choix retenu traîne sur l'appareil —
 * avancer et reculer restent, sans un mot d'erreur. Lu sur l'offre, pas sur
 * la capacité : la configuration en cache peut ne la dire qu'après coup
 * (mesuré au banc : la source Auto partait, puis la bonne 100 ms plus tard).
 */
export interface TrailerEngineRequest {
  /** La langue de la piste à afficher ; `null` : aucune. */
  subtitle: string | null;
  /** La hauteur demandée ; `null` : Auto. */
  quality: number | null;
}

export function trailerEngineRequest(input: {
  offered: { subtitles: readonly string[]; qualities: readonly number[] };
} & TrailerEngineRequest): TrailerEngineRequest {
  const { offered } = input;
  return {
    subtitle: input.subtitle !== null && offered.subtitles.includes(input.subtitle) ? input.subtitle : null,
    quality: input.quality !== null && offered.qualities.includes(input.quality) ? input.quality : null,
  };
}

/**
 * La qualité au LANCEMENT d'une bande-annonce : la plus haute que le serveur
 * offre (`qualities`), pas « Auto » — dont le maître démarre plus bas (choix
 * de Damien, 2026-10-11). « Auto » reste proposé ; rien ne se retient d'une
 * bande-annonce à l'autre : chaque lancement repart sur la plus haute. Sans
 * paliers (serveur d'avant), `null` : le flux d'aujourd'hui.
 */
export function trailerInitialQuality(heights: readonly number[]): number | null {
  return trailerQualityHeights(heights)[0] ?? null;
}
