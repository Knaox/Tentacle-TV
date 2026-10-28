/**
 * Octave — l'ORDRE d'une liste de titres (une playlist, « Titres likés ») :
 * le tri choisi, l'ordre personnalisé, et ce que le serveur sait de chaque
 * titre pour trier (ajout, écoutes). Capacité `music.listOrder` (1.40.0).
 *
 * Fichier du CONTRAT, recopié octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`) : le serveur sert les pages des likés
 * dans l'ordre que le client affiche (une page est toujours le DÉBUT de la
 * liste affichée — rien ne s'insère au-dessus en cours de chargement). Pur :
 * ni React, ni DOM, ni horloge.
 *
 * - Le tri et son sens sont une préférence du COMPTE, par liste.
 * - L'ordre personnalisé (`custom`) est une liste de clés de titre : un titre
 *   que l'ordre ne connaît pas encore (ajouté depuis) se pose juste après son
 *   prédécesseur dans l'ordre naturel (en tête s'il n'en a pas : un nouveau
 *   like arrive en haut, un ajout de playlist à sa place).
 * - Un titre en attente (hors bibliothèque) garde sa place quand il entre dans
 *   la bibliothèque : son entrée porte aussi son IDENTITÉ (`r`) — le MBID
 *   d'enregistrement, ou à défaut « titre | artiste » replié (`listAlias` : un
 *   titre importé n'a souvent pas de MBID).
 */

export type MusicListSortKey = "custom" | "added" | "title" | "artist" | "album" | "duration" | "year" | "plays" | "lastPlayed";
export type MusicListDirection = "asc" | "desc";

export const MUSIC_LIST_SORT_KEYS: readonly MusicListSortKey[] = ["custom", "added", "title", "artist", "album", "duration", "year", "plays", "lastPlayed"];

export const MUSIC_LIST_ROUTES = {
  /** GET — la préférence d'ordre d'une liste (`liked`, `playlist:<id>`) ; PUT `MusicListPrefs` — la remplace. */
  prefs: "/api/music/lists/:key/prefs",
  /** PUT { entryIds } — réécrit l'ordre de la playlist JELLYFIN (playlist modifiable seulement). */
  playlistOrder: "/api/music/playlists/:id/order",
} as const;

/** Une liste bornée : au-delà, l'ordre personnalisé est refusé (400). */
export const MUSIC_LIST_CUSTOM_MAX = 10_000;

/** Ce que le serveur sait d'un titre DANS une liste, pour la trier. */
export interface MusicListStats {
  /** Ms epoch : l'entrée dans la liste (relevée par Tentacle ; estimée pour ce qui y était avant). */
  addedAt: number | null;
  /** Les écoutes du compte (Jellyfin). */
  plays: number;
  lastPlayedAt: number | null;
}

/** Une place de l'ordre personnalisé : la clé du titre, et son identité (`listAlias`) s'il est en attente. */
export interface MusicCustomEntry {
  k: string;
  r?: string;
}

export interface MusicListPrefs {
  sort: MusicListSortKey;
  direction: MusicListDirection;
  /** `null` : jamais réordonnée (l'ordre naturel fait foi). */
  custom: MusicCustomEntry[] | null;
}

export type MusicListKey = "liked" | `playlist:${string}`;

export function parseListKey(raw: unknown): MusicListKey | null {
  if (raw === "liked") return "liked";
  if (typeof raw !== "string") return null;
  const match = /^playlist:([0-9a-fA-F-]{32,36})$/.exec(raw);
  return match ? (`playlist:${match[1]!.replace(/-/g, "").toLowerCase()}` as MusicListKey) : null;
}

/** Le sens qu'un tri prend quand on le choisit : le plus récent, le plus écouté, le plus long d'abord ; A → Z sinon. */
export function defaultDirection(sort: MusicListSortKey): MusicListDirection {
  return sort === "added" || sort === "plays" || sort === "lastPlayed" || sort === "year" ? "desc" : "asc";
}

/** Une playlist s'ouvre dans SON ordre ; les likés, le dernier like en tête. */
export function defaultListPrefs(key: MusicListKey): MusicListPrefs {
  return key === "liked" ? { sort: "added", direction: "desc", custom: null } : { sort: "custom", direction: "asc", custom: null };
}

/** La préférence reçue d'un client ; `null` si elle est mal formée. */
export function parseListPrefs(value: unknown): MusicListPrefs | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!MUSIC_LIST_SORT_KEYS.includes(v.sort as MusicListSortKey)) return null;
  if (v.direction !== "asc" && v.direction !== "desc") return null;
  if (v.custom === null || v.custom === undefined) return { sort: v.sort as MusicListSortKey, direction: v.direction, custom: null };
  if (!Array.isArray(v.custom) || v.custom.length > MUSIC_LIST_CUSTOM_MAX) return null;
  const custom: MusicCustomEntry[] = [];
  for (const entry of v.custom as unknown[]) {
    const e = entry as Record<string, unknown> | null;
    if (!e || typeof e.k !== "string" || e.k.length === 0 || e.k.length > 300) return null;
    if (e.r !== undefined && (typeof e.r !== "string" || e.r.length > 64)) return null;
    custom.push(e.r === undefined ? { k: e.k } : { k: e.k, r: e.r });
  }
  return { sort: v.sort as MusicListSortKey, direction: v.direction, custom };
}

/** Ce qu'un titre offre au tri (la vue le tire de son titre, le serveur de sa ligne d'index). */
export interface MusicListSubject {
  key: string;
  title: string;
  artist: string;
  album: string;
  disc: number | null;
  track: number | null;
  durationMs: number | null;
  year: number | null;
  /** L'identité qui survit à l'entrée dans la bibliothèque : `listAlias(…)`. */
  recording: string | null;
  stats: MusicListStats | null;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** L'identité d'un titre pour l'ordre personnalisé : son MBID d'enregistrement, sinon « titre | artiste » replié. */
export function listAlias(recording: string | null | undefined, title: string, artist: string): string | null {
  if (recording) return recording;
  const signature = `${fold(title)}|${fold(artist)}`;
  return signature === "|" ? null : `s:${signature}`.slice(0, 64);
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Une valeur absente va TOUJOURS à la fin, quel que soit le sens. */
function nullsLast(a: number | null, b: number | null, sign: number): number | null {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a === b ? 0 : (a - b) * sign;
}

function text(a: string, b: string, sign: number): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b) * sign;
}

/** L'album dans l'ordre de ses pistes (disque, puis piste), toujours croissant. */
function albumOrder(a: MusicListSubject, b: MusicListSubject): number {
  return (nullsLast(a.disc ?? 1, b.disc ?? 1, 1) || 0) || (nullsLast(a.track, b.track, 1) || 0);
}

function compare(a: MusicListSubject, b: MusicListSubject, sort: MusicListSortKey, sign: number): number {
  switch (sort) {
    case "title":
      return text(a.title, b.title, sign) || text(a.artist, b.artist, 1);
    case "artist":
      return text(a.artist, b.artist, sign) || text(a.album, b.album, 1) || albumOrder(a, b) || text(a.title, b.title, 1);
    case "album":
      return text(a.album, b.album, sign) || albumOrder(a, b) || text(a.title, b.title, 1);
    case "duration":
      return nullsLast(a.durationMs, b.durationMs, sign) || 0;
    case "year":
      return nullsLast(a.year, b.year, sign) || text(a.artist, b.artist, 1) || text(a.album, b.album, 1) || albumOrder(a, b);
    case "added":
      return nullsLast(a.stats?.addedAt ?? null, b.stats?.addedAt ?? null, sign) || 0;
    case "plays":
      return nullsLast(a.stats?.plays ?? 0, b.stats?.plays ?? 0, sign) || nullsLast(a.stats?.lastPlayedAt ?? null, b.stats?.lastPlayedAt ?? null, -1) || 0;
    case "lastPlayed":
      return nullsLast(a.stats?.lastPlayedAt ?? null, b.stats?.lastPlayedAt ?? null, sign) || 0;
    case "custom":
      return 0;
  }
}

/**
 * La liste dans l'ordre de la préférence. `natural` est l'ordre de la source (celui de la playlist ;
 * le dernier like en tête) : il départage tout ex æquo, et l'ordre personnalisé s'y applique.
 */
export function sortListItems<T>(natural: readonly T[], subjectOf: (item: T) => MusicListSubject, prefs: MusicListPrefs, newcomers: MusicListNewcomers = "after"): T[] {
  if (prefs.sort === "custom") return applyCustomOrder(natural, subjectOf, prefs.custom, newcomers);
  const sign = prefs.direction === "desc" ? -1 : 1;
  const decorated = natural.map((item, index) => ({ item, index, subject: subjectOf(item) }));
  // « Dernier ajout » : à date égale (un import entier, une arrivée posée à sa place), plus bas dans la liste =
  // ajouté après — l'ordre naturel suit le sens. Ailleurs, il départage toujours dans son ordre.
  const tieSign = prefs.sort === "added" ? sign : 1;
  decorated.sort((a, b) => compare(a.subject, b.subject, prefs.sort, sign) || (a.index - b.index) * tieSign);
  return decorated.map((d) => d.item);
}

/**
 * Où se pose un titre que l'ordre personnalisé ne connaît pas encore : juste après son prédécesseur naturel
 * (`after`, le défaut), ou à la FIN (`end` : une playlist partagée, où chacun garde son ordre et où un titre
 * ajouté par un autre entre au bout de l'ordre de chacun — `musicPlaylistMembers.ts`).
 */
export type MusicListNewcomers = "after" | "end";

/**
 * L'ordre personnalisé appliqué à l'ordre naturel. Un titre connu prend son rang ; un titre inconnu
 * se pose juste après son prédécesseur naturel (en tête sans prédécesseur) — ou à la fin (`newcomers`
 * = `end`) —, les inconnus consécutifs gardant leur ordre naturel. Un titre devenu « bibliothèque »
 * retrouve la place de son attente par son MBID d'enregistrement.
 */
export function applyCustomOrder<T>(
  natural: readonly T[],
  subjectOf: (item: T) => MusicListSubject,
  custom: readonly MusicCustomEntry[] | null,
  newcomers: MusicListNewcomers = "after",
): T[] {
  if (!custom || custom.length === 0) return [...natural];
  const byKey = new Map<string, number>();
  const byRecording = new Map<string, number>();
  custom.forEach((entry, rank) => {
    if (!byKey.has(entry.k)) byKey.set(entry.k, rank);
    if (entry.r && !byRecording.has(entry.r)) byRecording.set(entry.r, rank);
  });
  const subjects = natural.map(subjectOf);
  const present = new Set(subjects.map((s) => s.key));
  const taken = new Set<number>();
  const ranks: (number | null)[] = subjects.map((s) => {
    const own = byKey.get(s.key);
    if (own !== undefined && !taken.has(own)) {
      taken.add(own);
      return own;
    }
    // L'attente qu'il remplace n'est plus là : il hérite de sa place.
    const alias = s.recording ? byRecording.get(s.recording) : undefined;
    if (alias !== undefined && !taken.has(alias) && !present.has(custom[alias]!.k)) {
      taken.add(alias);
      return alias;
    }
    return null;
  });
  let anchor = -1;
  let sub = 0;
  const decorated = natural.map((item, index) => {
    const rank = ranks[index];
    if (rank !== null && rank !== undefined) {
      anchor = rank;
      sub = 0;
      return { item, rank, sub: 0 };
    }
    sub += 1;
    return { item, rank: newcomers === "end" ? custom.length : anchor, sub: newcomers === "end" ? index + 1 : sub };
  });
  decorated.sort((a, b) => a.rank - b.rank || a.sub - b.sub);
  return decorated.map((d) => d.item);
}

/** L'ordre affiché, à garder comme ordre personnalisé. */
export function customEntriesOf(subjects: readonly MusicListSubject[], pending: (subject: MusicListSubject) => boolean): MusicCustomEntry[] {
  const seen = new Set<string>();
  const out: MusicCustomEntry[] = [];
  for (const s of subjects) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(pending(s) && s.recording ? { k: s.key, r: s.recording } : { k: s.key });
  }
  return out;
}
