/**
 * Octave — la FILE D'ENVOI des ordres, sur l'appareil (lot « ol », 01/11) : un
 * glisser, un tri, l'ordre d'une rubrique de la bibliothèque s'appliquent tout
 * de suite à l'écran, entrent ici (stockage de l'appareil : la file survit à la
 * fermeture de l'app), puis partent. Faute de réseau, ils attendent et se
 * rejouent au retour (`flushOrderOutbox`, appelé à la reconnexion), FUSIONNÉS
 * avec ce que le serveur a entre-temps (règles pures : shared › `orderOutbox`,
 * `orderMerge`).
 *
 * Par identité (serveur + compte, profil compris : celle du cache d'Octave) —
 * jamais rejouée au nom d'un autre. Sans port (`configureOrderOutbox` jamais
 * appelé : webOS, tests) : l'envoi direct d'avant, sans file.
 *
 * Un refus du serveur (400, 403, 404 : playlist supprimée, droit retiré) retire
 * l'écriture ; seul un échec de transport (réseau, 5xx, 401, 408, 429) la garde.
 */

import {
  deferOrderWrite,
  enqueueOrderWrite,
  orderWriteTarget,
  parseOrderQueue,
  replayListPrefs,
  replayPlaylistOrder,
  replayShelfOrder,
  settleOrderWrite,
  type OrderWrite,
  type QueuedOrderWrite,
} from "@tentacle-tv/shared/octave";
import type { MusicLibraryShelves, MusicListPrefs, MusicPlaylistDetail, MusicShelfSection } from "@tentacle-tv/shared/music";
import type { StorageAdapter } from "../../storage";
import { TentacleApiError } from "../../hooks/usePreferences";
import { latestWinsQueue } from "../latestWinsQueue";

/** La clé de stockage (traversée par une chaîne : ne se renomme jamais). */
export const ORDER_OUTBOX_KEY = "tentacle_octave_order_outbox";

export interface OrderOutboxPort {
  storage: StorageAdapter;
  /** L'identité de la session (serveur + compte, profil compris) ; `null` : personne, rien ne se garde. */
  owner(): string | null;
}

/** Les requêtes (celles d'api-client), injectées pour les tests. */
export interface OrderOutboxApi {
  prefs(key: string): Promise<MusicListPrefs>;
  savePrefs(key: string, prefs: MusicListPrefs): Promise<unknown>;
  playlist(id: string): Promise<Pick<MusicPlaylistDetail, "entries">>;
  reorderPlaylist(id: string, entryIds: readonly string[]): Promise<unknown>;
  shelves(): Promise<Pick<MusicLibraryShelves, "order">>;
  shelfOrder(section: MusicShelfSection, keys: readonly string[]): Promise<unknown>;
}

let port: OrderOutboxPort | null = null;
let lastSeq = 0;
const listeners = new Set<() => void>();
const lane = latestWinsQueue();

export function configureOrderOutbox(next: OrderOutboxPort | null): void {
  port = next;
}

type Book = Record<string, QueuedOrderWrite[]>;

function readBook(): Book {
  try {
    const raw = port?.storage.getItem(ORDER_OUTBOX_KEY);
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== "object") return {};
    const book: Book = {};
    for (const [owner, queue] of Object.entries(value as Record<string, unknown>)) book[owner] = parseOrderQueue(queue);
    return book;
  } catch {
    return {};
  }
}

function update(owner: string, change: (queue: QueuedOrderWrite[]) => QueuedOrderWrite[]): void {
  if (!port) return;
  const book = readBook();
  const next = change(book[owner] ?? []);
  if (next.length > 0) book[owner] = next;
  else delete book[owner];
  try {
    if (Object.keys(book).length > 0) port.storage.setItem(ORDER_OUTBOX_KEY, JSON.stringify(book));
    else port.storage.removeItem(ORDER_OUTBOX_KEY);
  } catch {
    // Stockage plein ou refusé : l'écran garde le geste, l'envoi direct reste tenté.
  }
  for (const listener of listeners) listener();
}

/** Les écritures en attente de l'identité en cours. */
export function orderOutboxQueue(): QueuedOrderWrite[] {
  const owner = port?.owner();
  return owner ? (readBook()[owner] ?? []) : [];
}

export function subscribeOrderOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Un échec de TRANSPORT : l'écriture se garde et se rejoue ; un refus du serveur la retire. */
export function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof TentacleApiError)) return true;
  return error.status >= 500 || error.status === 401 || error.status === 408 || error.status === 429;
}

async function sendRaw(write: OrderWrite, api: OrderOutboxApi): Promise<void> {
  if (write.kind === "listPrefs") await api.savePrefs(write.key, write.prefs);
  else if (write.kind === "playlistOrder") await api.reorderPlaylist(write.playlistId, write.entryIds);
  else await api.shelfOrder(write.section, write.keys);
}

/** Relire le serveur, fusionner, écrire (`orderOutbox.ts` du partagé). */
async function sendMerged(write: OrderWrite, api: OrderOutboxApi): Promise<void> {
  if (write.kind === "listPrefs") {
    await api.savePrefs(write.key, replayListPrefs(write, await api.prefs(write.key)));
  } else if (write.kind === "playlistOrder") {
    const entries = (await api.playlist(write.playlistId)).entries.filter((e) => !e.entryId.startsWith("pending:"));
    const ids = replayPlaylistOrder(write, entries.map((e) => ({ entryId: e.entryId, key: e.track.key })));
    if (ids) await api.reorderPlaylist(write.playlistId, ids);
  } else {
    await api.shelfOrder(write.section, replayShelfOrder(write, (await api.shelves()).order[write.section] ?? []));
  }
}

/** Le dernier état de cette cible, envoyé : tel quel s'il est frais, par fusion s'il a attendu le réseau. */
async function drainTarget(owner: string, target: string, api: OrderOutboxApi, onSent: ((write: OrderWrite) => void) | undefined, merge: boolean): Promise<void> {
  if (port?.owner() !== owner) return;
  const queued = (readBook()[owner] ?? []).find((q) => q.target === target);
  if (!queued) return;
  try {
    await (merge || queued.deferred ? sendMerged : sendRaw)(queued.write, api);
    update(owner, (queue) => settleOrderWrite(queue, target, queued.seq));
    onSent?.(queued.write);
  } catch (error) {
    if (isTransportFailure(error)) update(owner, (queue) => deferOrderWrite(queue, target));
    else update(owner, (queue) => settleOrderWrite(queue, target, queued.seq));
    throw error;
  }
}

/**
 * Un geste d'ordre : gardé dans la file, puis envoyé (le dernier d'une cible gagne). `onSent` : la vérité du
 * serveur est à relire. Sans port ni identité, l'envoi direct d'avant.
 */
export function sendOrderWrite(write: OrderWrite, api: OrderOutboxApi, onSent?: (write: OrderWrite) => void): Promise<void> {
  const target = orderWriteTarget(write);
  const owner = port?.owner() ?? null;
  if (!owner) return lane(target, () => sendRaw(write, api).then(() => onSent?.(write)));
  lastSeq = Math.max(lastSeq + 1, Date.now());
  const seq = lastSeq;
  update(owner, (queue) => enqueueOrderWrite(queue, write, seq));
  return lane(target, () => drainTarget(owner, target, api, onSent, false));
}

/**
 * Au retour du réseau (et au démarrage en ligne) : tout ce qui attend part, FUSIONNÉ — une écriture encore là a
 * attendu (l'app a pu être fermée avant même que son envoi échoue).
 */
export function flushOrderOutbox(api: OrderOutboxApi, onSent?: (write: OrderWrite) => void): Promise<void> {
  const owner = port?.owner() ?? null;
  if (!owner) return Promise.resolve();
  const targets = (readBook()[owner] ?? []).map((q) => q.target);
  return Promise.all(targets.map((target) => lane(target, () => drainTarget(owner, target, api, onSent, true)))).then(() => undefined);
}
