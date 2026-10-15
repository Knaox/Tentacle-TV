import type { PlaybackRefusal } from "@tentacle-tv/shared";
import type { PrismStart } from "../utils/prismCoreStart";

/** Le flux résolu par la variante tvOS de `useTVStreamUrl` (extrait : budget 300 lignes). */
export interface StreamResult {
  baseUrl: string | null;
  resumeFrag?: string;
  playSessionId?: string;
  isDirectPlay: boolean;
  /** Lecture directe servie par PrismCore (HLS local, timeline absolue). */
  isPrismCore?: boolean;
  /** Ce que PrismCore a rendu au démarrage (pistes transportées, renditions…). */
  prism?: PrismStart;
  /** Résolution du flux ÉCHOUÉE : l'écran de chargement affiche une erreur +
   *  « Réessayer » au lieu de tourner pour toujours. */
  failed?: boolean;
  /** Les droits de lecture du compte refusent ce flux : rien n'est demandé,
   *  l'écran le dit, sans « Réessayer » (docs/DROITS-UTILISATEURS.md § 9.2). */
  refusal?: PlaybackRefusal;
}

export const fragmentAt = (sec: number) => (sec > 1 ? `#tnt-start=${Math.floor(sec)}` : "");

/** Le résultat d'un refus des droits : un échec dit, jamais une URL. */
export const refusedStream = (refusal: PlaybackRefusal): StreamResult => ({ baseUrl: null, isDirectPlay: false, failed: true, refusal });
