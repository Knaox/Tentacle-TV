import { trailerQualityHeights } from "./trailerPanels";

/**
 * Ce que la bande-annonce DEMANDE au moteur : la langue des sous-titres et la
 * hauteur choisies — seulement parmi ce que le flux OFFRE. Un serveur d'avant
 * (sans `trailers.player`) n'offre ni pistes ni paliers : rien n'est demandé
 * (Auto, aucun sous-titre), même si un choix retenu traîne sur le téléviseur —
 * avancer et reculer restent, sans un mot d'erreur. Lu sur l'offre, pas sur
 * la capacité : la configuration en cache peut ne la dire qu'après coup
 * (mesuré au banc : la source Auto partait, puis la bonne 100 ms plus tard).
 * Les BOUTONS, eux, restent gardés par la capacité (`trailerTools`). Module pur.
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
 * de Damien, 2026-10-11). « Auto » reste proposé dans le panneau ; rien ne se
 * retient d'une bande-annonce à l'autre : chaque lancement repart sur la plus
 * haute. Sans paliers (serveur d'avant), `null` : le flux d'aujourd'hui.
 */
export function trailerInitialQuality(heights: readonly number[]): number | null {
  return trailerQualityHeights(heights)[0] ?? null;
}
