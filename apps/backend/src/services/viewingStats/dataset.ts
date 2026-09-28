/**
 * Le jeu de données d'un compte, tel que le calcul pur le consomme.
 *
 * Il est assemblé à chaque calcul (Jellyfin + `watch_segments` + fiches TMDB
 * en cache), sert aux trois périodes d'un coup, puis est abandonné : seul le
 * RÉSULTAT, quelques kilo-octets, reste en cache. Rien ici ne vit au-delà
 * d'un calcul.
 */

export interface PersonRef {
  id: number;
  name: string;
}

/** Un film ou une série, avec ce qu'on sait de lui. */
export interface TitleInfo {
  /** Identifiant Jellyfin. */
  id: string;
  kind: "movie" | "series";
  name: string;
  year: number | null;
  tmdbId: number | null;
  /** Genres TMDB (ids) : la fiche TMDB, sinon les noms Jellyfin rapprochés. */
  genreIds: number[];
  /** Langue originale ISO 639-1, connue par la fiche TMDB seulement. */
  language: string | null;
  anime: boolean;
  /** Films : réalisateurs. Séries : créateurs. Vides sans fiche TMDB. */
  directors: PersonRef[];
  /** Les premiers rôles (cinq au plus). */
  cast: PersonRef[];
}

/** Un film vu, ou un épisode vu, tel que Jellyfin le rapporte. */
export interface PlayedEntry {
  /** Le titre compté : le film lui-même, ou la série de l'épisode. */
  titleId: string;
  /** Le film ou l'épisode. */
  itemId: string;
  kind: "movie" | "episode";
  runtimeSeconds: number;
  /** `LastPlayedDate` brute (ms), null si absente. */
  lastPlayedAt: number | null;
  /**
   * Marqué « vu » en masse (quatre titres ou plus dans la même minute) : la
   * date existe mais ne dit rien du visionnage. Le titre compte dans « tout »,
   * jamais dans une période datée ni dans la frise.
   */
  bulk: boolean;
}

/** Une séance chronométrée par Tentacle (`watch_segments`). */
export interface MeasuredEntry {
  /** Le film, ou la série de l'épisode. */
  titleId: string;
  itemId: string;
  kind: "movie" | "episode";
  /** Nom brut de l'application Jellyfin (« Tentacle TV - Mobile »…). */
  client: string | null;
  seconds: number;
  runtimeSeconds: number | null;
  startedAt: number;
  lastSeenAt: number;
}

export interface StatsDataset {
  titles: Map<string, TitleInfo>;
  played: PlayedEntry[];
  measured: MeasuredEntry[];
  /** Premier segment mesuré, TOUS comptes confondus (ms) ; null sans mesure. */
  epoch: number | null;
}

/** La date d'un titre vu quand elle est fiable, null sinon. */
export function reliableDate(entry: PlayedEntry): number | null {
  return entry.bulk ? null : entry.lastPlayedAt;
}

/**
 * LE RACCORD, repris du classement de visionnage (`leaderboard/coreStats`) :
 * un titre vu AVANT la première mesure — ou sans date — est estimé par sa
 * durée ; après, c'est la mesure qui le compte. Le compter deux fois
 * gonflerait tout ; ne pas le compter du tout ferait repartir de zéro le jour
 * où la mesure démarre.
 */
export function isEstimated(entry: PlayedEntry, epoch: number | null): boolean {
  return epoch === null || entry.lastPlayedAt === null || entry.lastPlayedAt < epoch;
}

/** Quatre titres ou plus marqués dans la même minute : un marquage en masse. */
export const BULK_MIN_ITEMS = 4;

/** Repère les minutes de marquage en masse et pose `bulk` sur leurs entrées. */
export function flagBulkMarks(entries: PlayedEntry[]): void {
  const perMinute = new Map<number, number>();
  for (const e of entries) {
    if (e.lastPlayedAt === null) continue;
    const minute = Math.floor(e.lastPlayedAt / 60_000);
    perMinute.set(minute, (perMinute.get(minute) ?? 0) + 1);
  }
  for (const e of entries) {
    if (e.lastPlayedAt === null) continue;
    e.bulk = (perMinute.get(Math.floor(e.lastPlayedAt / 60_000)) ?? 0) >= BULK_MIN_ITEMS;
  }
}
