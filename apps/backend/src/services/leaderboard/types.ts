/**
 * Classement de visionnage — contrat partagé backend ↔ web.
 *
 * Dupliqué côté web plutôt qu'importé : `apps/backend` ne dépend pas de
 * `@tentacle-tv/shared` (voir son package.json), et `services/watchTogether/
 * protocol.ts` établit déjà ce précédent.
 */

/**
 * D'où viennent les durées — jamais deviné, toujours dit.
 *  • `mesure`      tout le total a été chronométré par Tentacle ;
 *  • `mixte`       mesuré depuis l'époque, estimé avant ;
 *  • `estimation`  rien n'a encore été mesuré.
 */
export type SourceClassement = "mesure" | "mixte" | "estimation";

export interface LigneClassement {
  userId: string;
  name: string;
  hasAvatar: boolean;
  /** Films marqués comme vus. Chiffre EXACT, lu de Jellyfin. */
  moviesPlayed: number;
  /** Épisodes marqués comme vus. Chiffre EXACT. */
  episodesPlayed: number;
  totalPlayed: number;
  /**
   * Secondes de visionnage. `null` quand rien n'a été vu — et `null` n'est pas
   * `0` : « on ne sait pas » et « n'a rien regardé » ne se disent pas pareil.
   */
  watchSeconds: number | null;
  /** Part RÉELLEMENT chronométrée dans ce total. */
  measuredSeconds: number;
  /** Part reconstituée, antérieure à la première mesure. */
  estimatedSeconds: number;
  /** Date de la dernière lecture connue, ISO. */
  lastPlayedDate: string | null;
}

export interface Classement {
  source: SourceClassement;
  /** Instant depuis lequel Tentacle chronomètre, ISO. `null` avant la 1re mesure. */
  measuredSince: string | null;
  /**
   * Vrai quand `watchSeconds` est reconstruit à partir de la durée des titres
   * vus (durée × nombre de lectures) faute du plugin Playback Reporting. Cette
   * reconstitution ignore les abandons et les avances rapides : elle
   * SURESTIME, et l'interface doit le dire.
   */
  estimated: boolean;
  generatedAt: string;
  entries: LigneClassement[];
}

export interface SerieFavorite {
  seriesId: string;
  name: string;
  episodesPlayed: number;
  playCount: number;
}
