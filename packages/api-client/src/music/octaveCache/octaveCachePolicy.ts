/**
 * Octave — CE QUI se garde sur l'appareil, et COMBIEN de temps (règle pure).
 *
 * Une recherche déjà faite, un album ou un artiste hors bibliothèque déjà
 * ouvert se rouvrent sans attendre, même après un redémarrage : leur page est
 * gardée (IndexedDB), rendue au cache de requêtes au montage d'Octave, puis
 * revalidée en silence comme toute donnée périmée (la page Recherche ne
 * réordonne jamais ce qu'elle montre). Le cœur ne sait pas d'où viennent ces
 * pages : il garde les clés `["music", …]` de l'extension telles quelles.
 *
 * - Recherche (`external-search`) : seulement FINIE (dernière page `complete`)
 *   et jamais provisoire — un classement qui allait changer ne se fige pas ;
 *   gardée 3 jours.
 * - Vue album / artiste / playlist (`external`) : une réponse non vide ; 14 jours.
 * - Pages de la BIBLIOTHÈQUE (`library` : accueil, playlists, albums, artistes,
 *   titres likés, statut) : ce qu'un lancement en Octave montre avant tout
 *   réseau, puis revalide en silence ; 14 jours. Avec eux, le tri choisi d'une
 *   liste (`list-prefs`) : une playlist gardée s'ouvre hors ligne dans l'ordre
 *   où le compte la voit en ligne.
 *
 * Les playlists sont ANCRÉES (`anchoredKey`) : une playlist, la liste des
 * playlists, les titres likés, les attentes de l'extension (les titres importés
 * pas encore dans la bibliothèque, qu'une playlist montre à leur place) et le
 * tri d'une playlist, et les FAVORIS de la bibliothèque avec l'ordre de ses rubriques (`shelves` : « Vos
 * favoris » se montre hors ligne comme en ligne), gardent leur DERNIER affichage en ligne sans limite d'âge,
 * et partent les derniers quand la place manque : une playlist s'ouvre hors
 * ligne, dans son ordre, avec ses pochettes et ses titres, même des semaines
 * après, même après avoir quitté l'application.
 *
 * Rangées PAR IDENTITÉ (serveur + compte, profil compris) : jamais rendues à
 * une autre ; les `MAX_OWNERS` identités les plus récentes gardent chacune
 * leurs bornes (changer de profil dans Octave ne repart pas à froid), les
 * autres sont effacées. La déconnexion efface tout.
 */

export const SEARCH_MAX_AGE_MS = 3 * 24 * 3_600_000;
export const ENTITY_MAX_AGE_MS = 14 * 24 * 3_600_000;
/** Bornes du stockage PAR IDENTITÉ (LRU par dernière utilisation) : ~150 pages, quelques Mo. */
export const MAX_ENTRIES = 150;
export const MAX_BYTES = 6 * 1024 * 1024;
/** Au plus tant d'identités gardées sur l'appareil (les plus récemment utilisées). */
export const MAX_OWNERS = 4;

export type PersistKind = "search" | "entity" | "library";

/** Les pages de la bibliothèque qu'Octave rouvre sans réseau (clés de `musicKeys`). */
const LIBRARY_SCOPES: ReadonlySet<unknown> = new Set(["home", "status", "playlists", "playlist", "album", "artist", "albums", "artists", "liked", "list-prefs", "pending", "shelves"]);

/** Les débuts de clé (sérialisée) des pages ancrées : jamais expirées, évincées en dernier. */
const ANCHORED_PREFIXES = ['["music","playlist",', '["music","playlists"]', '["music","liked",', '["music","pending",', '["music","list-prefs","playlist:', '["music","list-prefs","liked"', '["music","shelves"]'];

/** Cette clé de requête sérialisée est-elle celle d'une page de playlist ancrée ? */
export function anchoredKey(keyJson: string): boolean {
  return ANCHORED_PREFIXES.some((prefix) => keyJson.startsWith(prefix));
}

export interface StoredEntry {
  /** L'identifiant de stockage : l'identité et la clé (`entryId`). Une entrée d'avant n'avait que la clé. */
  id: string;
  /** La clé de requête, sérialisée (`JSON.stringify(queryKey)`) ; absente d'une entrée d'avant (c'était `id`). */
  key?: string;
  owner: string;
  kind: PersistKind;
  data: unknown;
  /** Quand la donnée a été reçue (`dataUpdatedAt`). */
  savedAt: number;
  /** Dernière fois qu'elle a été rendue au cache ou réécrite (éviction). */
  usedAt: number;
  /** Taille estimée (JSON), pour le budget. */
  bytes: number;
}

/** Deux identités gardent la même clé de requête sans s'écraser. */
export function entryId(owner: string, keyJson: string): string {
  return `${owner}\n${keyJson}`;
}

/** La clé de requête sérialisée d'une entrée (format d'avant compris). */
export function entryKey(entry: Pick<StoredEntry, "id" | "key">): string {
  return entry.key ?? entry.id;
}

export function persistKindOf(queryKey: unknown): PersistKind | null {
  if (!Array.isArray(queryKey) || queryKey[0] !== "music") return null;
  if (queryKey[1] === "external-search") return "search";
  if (queryKey[1] === "external") return "entity";
  if (LIBRARY_SCOPES.has(queryKey[1])) return "library";
  return null;
}

interface PageLike {
  complete?: unknown;
  provisional?: unknown;
}

/** Une recherche infinie (`{ pages }`) finie et sûre. */
function finishedSearch(data: unknown): boolean {
  const pages = (data as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return false;
  const last = pages[pages.length - 1] as PageLike | null;
  if (!last || last.complete !== true) return false;
  return !pages.some((p) => (p as PageLike | null)?.provisional === true);
}

/** La donnée de cette clé mérite-t-elle d'être gardée telle qu'elle est ? */
export function persistable(kind: PersistKind, data: unknown): boolean {
  if (data === null || data === undefined) return false;
  return kind === "search" ? finishedSearch(data) : typeof data === "object";
}

export function maxAgeOf(kind: PersistKind): number {
  return kind === "search" ? SEARCH_MAX_AGE_MS : ENTITY_MAX_AGE_MS;
}

export function expired(entry: Pick<StoredEntry, "kind" | "savedAt" | "id" | "key">, now: number): boolean {
  if (entry.kind === "library" && anchoredKey(entryKey(entry))) return false;
  return now - entry.savedAt > maxAgeOf(entry.kind);
}

/**
 * Les identifiants à retirer pour tenir les bornes : d'abord les expirées (jamais une page ancrée),
 * puis les identités au-delà des `maxOwners` plus récentes (celle en cours
 * toujours gardée), puis, identité par identité, les moins récemment
 * utilisées.
 */
export function evictionPlan(
  entries: readonly StoredEntry[],
  owner: string,
  now: number,
  maxEntries = MAX_ENTRIES,
  maxBytes = MAX_BYTES,
  maxOwners = MAX_OWNERS,
): string[] {
  const drop: string[] = [];
  const byOwner = new Map<string, StoredEntry[]>();
  for (const e of entries) {
    if (expired(e, now)) drop.push(e.id);
    else byOwner.set(e.owner, [...(byOwner.get(e.owner) ?? []), e]);
  }
  const recency = (list: readonly StoredEntry[]) => Math.max(...list.map((e) => e.usedAt));
  const owners = [...byOwner.keys()].sort((a, b) => (a === owner ? -1 : b === owner ? 1 : recency(byOwner.get(b)!) - recency(byOwner.get(a)!)));
  owners.forEach((who, rank) => {
    // Les pages ancrées d'abord : la place qui manque se prend sur les autres.
    const anchored = (e: StoredEntry) => (e.kind === "library" && anchoredKey(entryKey(e)) ? 1 : 0);
    const kept = [...byOwner.get(who)!].sort((a, b) => anchored(b) - anchored(a) || b.usedAt - a.usedAt);
    let bytes = 0;
    kept.forEach((e, i) => {
      bytes += e.bytes;
      if (rank >= maxOwners || i >= maxEntries || bytes > maxBytes) drop.push(e.id);
    });
  });
  return drop;
}
