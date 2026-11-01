/**
 * Octave — la FILE D'ENVOI des ordres (lot « ol », 01/11), règle pure
 * (`orderOutbox.test.ts`) : ce qu'un glisser ou un tri a changé et que le serveur
 * n'a pas encore reçu (hors ligne, réseau coupé). La file vit sur l'appareil
 * (`@tentacle-tv/api-client` › `orderOutbox`, survit à la fermeture de l'app) et
 * se rejoue au retour du réseau, fusionnée avec ce que le serveur a entre-temps
 * (`orderMerge.ts`).
 *
 * - Une écriture par CIBLE (`orderWriteTarget`) : la dernière gagne, mais la
 *   `base` reste celle du PREMIER geste en attente — c'est contre elle que se lit
 *   ce que l'appareil a déplacé.
 * - `deferred` : un envoi a déjà échoué faute de réseau ; l'écriture se rejoue
 *   alors par fusion (relire, fusionner, écrire), jamais telle quelle.
 * - Rejouer est idempotent : chaque écriture porte l'ordre COMPLET.
 */

import type { MusicCustomEntry, MusicListPrefs, MusicShelfSection } from "../../music";
import { mergeOrder, sameOrder, withOccurrences } from "./orderMerge";

/** Le tri et l'ordre personnalisé d'une liste (`PUT /api/music/lists/:key/prefs`). */
export interface ListPrefsWrite {
  kind: "listPrefs";
  key: string;
  prefs: MusicListPrefs;
  /** Les clés MONTRÉES avant le premier glisser en attente ; `null` : seul le tri a changé. */
  base: string[] | null;
}

/** L'ordre d'une playlist Jellyfin (`PUT /api/music/playlists/:id/order`). */
export interface PlaylistOrderWrite {
  kind: "playlistOrder";
  playlistId: string;
  /** Les entrées dans l'ordre voulu, telles que l'appareil les connaissait (l'envoi immédiat). */
  entryIds: string[];
  /** Les mêmes, par clé de titre (le rejeu : les entrées changent quand Jellyfin réécrit la playlist). */
  keys: string[];
  /** Les clés des entrées dans l'ordre d'avant le premier glisser en attente. */
  base: string[];
}

/** L'ordre personnel d'une rubrique de la bibliothèque (`PUT /api/music/library/order/:section`). */
export interface ShelfOrderWrite {
  kind: "shelfOrder";
  section: MusicShelfSection;
  keys: string[];
  base: string[];
}

export type OrderWrite = ListPrefsWrite | PlaylistOrderWrite | ShelfOrderWrite;

export interface QueuedOrderWrite {
  target: string;
  write: OrderWrite;
  /** Un envoi a échoué faute de réseau : rejouer par fusion. */
  deferred: boolean;
  /** Numéro de l'écriture (un envoi réussi ne retire que celle qu'il portait). */
  seq: number;
}

export function orderWriteTarget(write: OrderWrite): string {
  if (write.kind === "listPrefs") return `prefs:${write.key}`;
  if (write.kind === "playlistOrder") return `order:${write.playlistId}`;
  return `shelf:${write.section}`;
}

function keepBase(previous: OrderWrite, next: OrderWrite): OrderWrite {
  if (previous.kind === "listPrefs" && next.kind === "listPrefs") return { ...next, base: previous.base ?? next.base };
  if (previous.kind === "playlistOrder" && next.kind === "playlistOrder") return { ...next, base: previous.base };
  if (previous.kind === "shelfOrder" && next.kind === "shelfOrder") return { ...next, base: previous.base };
  return next;
}

/** La file après un nouveau geste : il remplace l'écriture en attente de sa cible, en gardant sa base. */
export function enqueueOrderWrite(queue: readonly QueuedOrderWrite[], write: OrderWrite, seq: number): QueuedOrderWrite[] {
  const target = orderWriteTarget(write);
  const previous = queue.find((q) => q.target === target);
  const queued: QueuedOrderWrite = previous
    ? { target, write: keepBase(previous.write, write), deferred: previous.deferred, seq }
    : { target, write, deferred: false, seq };
  return [...queue.filter((q) => q.target !== target), queued];
}

/** La file après un envoi réussi : l'écriture part, sauf si un geste plus récent l'a remplacée entre-temps. */
export function settleOrderWrite(queue: readonly QueuedOrderWrite[], target: string, seq: number): QueuedOrderWrite[] {
  return queue.filter((q) => !(q.target === target && q.seq === seq));
}

/** La file après un envoi échoué faute de réseau : l'écriture se rejouera par fusion. */
export function deferOrderWrite(queue: readonly QueuedOrderWrite[], target: string): QueuedOrderWrite[] {
  return queue.map((q) => (q.target === target ? { ...q, deferred: true } : q));
}

/** Une file relue du disque ; ce qui est mal formé est ignoré (jamais une erreur au démarrage). */
export function parseOrderQueue(raw: unknown): QueuedOrderWrite[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is QueuedOrderWrite => {
    const v = q as Partial<QueuedOrderWrite> | null;
    const kind = (v?.write as { kind?: unknown } | undefined)?.kind;
    return !!v && typeof v.target === "string" && typeof v.seq === "number" && (kind === "listPrefs" || kind === "playlistOrder" || kind === "shelfOrder");
  });
}

const keysOf = (custom: readonly MusicCustomEntry[] | null): string[] | null => (custom ? custom.map((e) => e.k) : null);

/**
 * La préférence à écrire au rejeu, d'après celle du serveur maintenant. Le tri et le sens choisis hors ligne
 * gagnent (le dernier geste du compte) ; l'ordre personnalisé se fusionne.
 */
export function replayListPrefs(write: ListPrefsWrite, remote: MusicListPrefs): MusicListPrefs {
  const local = write.prefs;
  // Seul le tri a changé : l'ordre personnalisé est celui du serveur (un autre appareil a pu glisser).
  if (write.base === null || local.custom === null) return { ...local, custom: remote.custom ?? local.custom };
  // Jamais réordonnée ailleurs : rien à fusionner.
  if (remote.custom === null) return local;
  const merged = mergeOrder(write.base, keysOf(local.custom)!, keysOf(remote.custom)!, "union");
  const entryOf = new Map<string, MusicCustomEntry>();
  for (const e of remote.custom) entryOf.set(e.k, e);
  for (const e of local.custom) entryOf.set(e.k, e);
  return { ...local, custom: merged.map((k) => entryOf.get(k) ?? { k }) };
}

export interface FreshEntry {
  entryId: string;
  key: string;
}

/** Les entrées à envoyer au rejeu, d'après la playlist maintenant ; `null` : elle est déjà dans cet ordre. */
export function replayPlaylistOrder(write: PlaylistOrderWrite, fresh: readonly FreshEntry[]): string[] | null {
  const remote = withOccurrences(fresh.map((e) => e.key));
  const merged = mergeOrder(withOccurrences(write.base), withOccurrences(write.keys), remote, "remote");
  if (sameOrder(merged, remote)) return null;
  const entryOf = new Map(remote.map((key, index) => [key, fresh[index]!.entryId]));
  return merged.map((key) => entryOf.get(key)!);
}

/** L'ordre d'une rubrique à écrire au rejeu, d'après celui du serveur maintenant. */
export function replayShelfOrder(write: ShelfOrderWrite, remote: readonly string[]): string[] {
  return mergeOrder(write.base, write.keys, remote, "union");
}

/** Ce que voit l'appareil tant que l'écriture n'est pas partie : la préférence en attente la plus récente. */
export function pendingListPrefs(queue: readonly QueuedOrderWrite[], key: string): MusicListPrefs | null {
  const queued = queue.find((q) => q.target === `prefs:${key}`);
  return queued?.write.kind === "listPrefs" ? queued.write.prefs : null;
}

/** L'ordre de rubrique en attente, s'il y en a un. */
export function pendingShelfOrder(queue: readonly QueuedOrderWrite[], section: MusicShelfSection): string[] | null {
  const queued = queue.find((q) => q.target === `shelf:${section}`);
  return queued?.write.kind === "shelfOrder" ? queued.write.keys : null;
}
