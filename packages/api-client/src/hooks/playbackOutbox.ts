import type { PlaybackStateDto } from "@tentacle-tv/shared";

/**
 * La file PERSISTÉE des rapports de lecture : ce qui doit atteindre Jellyfin
 * même si l'app meurt, se suspend, ou si le serveur ne répond pas.
 *
 * Sans elle, un arrêt raté était perdu — et l'app tuée en pleine lecture ne
 * laissait que ce que le backend devinait (sa position extrapolée pendant le
 * délai de grâce, mesurée ~5 s trop loin). Deux sortes d'entrées, une par titre :
 *
 * - `live` : la position d'une lecture EN COURS, notée au fil de l'eau (toutes
 *   les `LIVE_NOTE_MS`, et à chaque bord : pause, reprise, saut). L'app morte,
 *   elle devient l'arrêt de cette lecture ;
 * - `stop` : l'arrêt d'une lecture finie, noté AVANT l'envoi, retiré quand le
 *   serveur l'a pris.
 *
 * La file se vide au démarrage, au retour au premier plan et au retour du
 * réseau (`flushPlaybackOutbox`). Jamais de rapport périmé : une entrée ne part
 * pas si Jellyfin a vu une lecture du titre DEPUIS (elle porte sa propre
 * position), ni pour le titre en cours de lecture, ni pour un autre compte ou un
 * autre appareil que ceux qui l'ont écrite (un rejumelage ne vide jamais les
 * rapports du compte précédent avec le jeton du suivant). Opt-in, comme le canal
 * de session : seul l'hôte qui l'a configurée (la TV) l'utilise. La clé est une
 * donnée du COMPTE : le déjumelage la purge (`ACCOUNT_STORAGE_KEYS`, tv-core).
 */

/** Le stockage de l'hôte (NSUserDefaults sur tvOS, AsyncStorage sur Android TV). */
export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** À qui appartient un rapport : le compte et l'appareil qui l'ont écrit. */
export interface OutboxOwner {
  userId: string;
  deviceId: string;
}

export interface OutboxEntry {
  state: PlaybackStateDto;
  owner: OutboxOwner;
  kind: "live" | "stop";
  /** Écriture de l'entrée, horloge de l'appareil (ms). */
  recordedAt: number;
  attempts: number;
}

/** Ce dont le vidage a besoin du réseau — injecté, pour rester testable. */
export interface OutboxFlushDeps {
  /** Dernière lecture du titre connue de Jellyfin (ms), `null` si aucune, "gone"
   *  si le titre n'existe plus. Lève si le serveur ne répond pas. */
  lastPlayedAt: (itemId: string) => Promise<number | null | "gone">;
  /** Poste l'arrêt ; vrai si le serveur l'a pris. */
  sendStop: (state: PlaybackStateDto) => Promise<boolean>;
}

export interface OutboxFlushResult {
  sent: number;
  dropped: number;
  kept: number;
}

/** Clé de stockage — un nom traversé par une chaîne : ne jamais la renommer. */
export const OUTBOX_KEY = "tentacle_playback_outbox";
/** Une position en cours n'est notée qu'à ce rythme (hors bords). */
export const LIVE_NOTE_MS = 2_000;
/** Au-delà, un rapport ne dit plus rien d'utile : il est abandonné. */
export const OUTBOX_MAX_AGE_MS = 7 * 24 * 3_600_000;
export const OUTBOX_MAX_ATTEMPTS = 20;

let store: OutboxStorage | null = null;
let ownerOf: () => OutboxOwner | null = () => null;
let clock: () => number = Date.now;
/** Le titre en cours de lecture : le vidage n'y touche pas. */
let liveItemId: string | null = null;
let lastLiveNoteAt = 0;
let flushing: Promise<OutboxFlushResult> | null = null;

/** Active la file (`null` la coupe). `owner` : la session courante, `null` sans session. */
export function configurePlaybackOutbox(
  storage: OutboxStorage | null,
  owner: () => OutboxOwner | null,
  now: () => number = Date.now,
): void {
  store = storage;
  ownerOf = owner;
  clock = now;
  liveItemId = null;
  lastLiveNoteAt = 0;
}

export function isPlaybackOutboxActive(): boolean {
  return store !== null;
}

/** Les entrées en attente, par titre. */
export function readPlaybackOutbox(): Record<string, OutboxEntry> {
  if (!store) return {};
  try {
    const raw = store.getItem(OUTBOX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, OutboxEntry>) : {};
  } catch {
    return {};
  }
}

function write(entries: Record<string, OutboxEntry>): void {
  if (!store) return;
  if (Object.keys(entries).length === 0) store.removeItem(OUTBOX_KEY);
  else store.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

/**
 * Note la position d'une lecture EN COURS. `edge` : pause, reprise ou saut —
 * noté tout de suite ; sinon au plus toutes les `LIVE_NOTE_MS`. La note
 * remplace ce qui attendait pour le titre : une nouvelle lecture dépasse
 * l'arrêt d'une précédente.
 */
export function notePlaybackLive(state: PlaybackStateDto, edge = false): void {
  const owner = store ? ownerOf() : null;
  if (!owner) return;
  const now = clock();
  if (!edge && liveItemId === state.itemId && now - lastLiveNoteAt < LIVE_NOTE_MS) return;
  liveItemId = state.itemId;
  lastLiveNoteAt = now;
  const entries = readPlaybackOutbox();
  entries[state.itemId] = { state, owner, kind: "live", recordedAt: now, attempts: 0 };
  write(entries);
}

/** L'arrêt d'une lecture, noté AVANT l'envoi. Rend sa marque (0 sans file). */
export function notePlaybackStop(state: PlaybackStateDto): number {
  const owner = store ? ownerOf() : null;
  if (!owner) return 0;
  if (liveItemId === state.itemId) liveItemId = null;
  const now = clock();
  const entries = readPlaybackOutbox();
  entries[state.itemId] = { state, owner, kind: "stop", recordedAt: now, attempts: 0 };
  write(entries);
  return now;
}

const sameOwner = (a: OutboxOwner | undefined, b: OutboxOwner | null): boolean =>
  !!a && !!b && a.userId === b.userId && a.deviceId === b.deviceId;

/** Le serveur a pris l'entrée notée à `recordedAt` : elle sort — une plus récente reste. */
export function settlePlayback(itemId: string, recordedAt: number): void {
  const entries = readPlaybackOutbox();
  const entry = entries[itemId];
  if (!entry || entry.recordedAt > recordedAt) return;
  delete entries[itemId];
  write(entries);
}

function drop(itemId: string, recordedAt: number): void {
  settlePlayback(itemId, recordedAt);
}

function countAttempt(itemId: string, recordedAt: number): void {
  const entries = readPlaybackOutbox();
  const entry = entries[itemId];
  if (!entry || entry.recordedAt !== recordedAt) return;
  entries[itemId] = { ...entry, attempts: entry.attempts + 1 };
  write(entries);
}

/** Vide la file — un seul vidage à la fois ; un appel pendant un vidage le rejoint. */
export function flushPlaybackOutbox(deps: OutboxFlushDeps): Promise<OutboxFlushResult> {
  if (!store) return Promise.resolve({ sent: 0, dropped: 0, kept: 0 });
  flushing ??= runFlush(deps).finally(() => { flushing = null; });
  return flushing;
}

async function runFlush(deps: OutboxFlushDeps): Promise<OutboxFlushResult> {
  const result: OutboxFlushResult = { sent: 0, dropped: 0, kept: 0 };
  const owner = ownerOf();
  // Sans session, rien ne part ni ne se jette : la session revenue videra la file.
  if (!owner) return result;
  const pending = Object.entries(readPlaybackOutbox()).filter(([itemId]) => itemId !== liveItemId);
  for (let i = 0; i < pending.length; i++) {
    const [itemId, entry] = pending[i];
    const stale = clock() - entry.recordedAt > OUTBOX_MAX_AGE_MS || entry.attempts >= OUTBOX_MAX_ATTEMPTS;
    if (stale || !sameOwner(entry.owner, owner)) {
      drop(itemId, entry.recordedAt);
      result.dropped++;
      continue;
    }
    let playedAt: number | null | "gone";
    try {
      playedAt = await deps.lastPlayedAt(itemId);
    } catch {
      // Serveur muet : tout reste pour le prochain vidage.
      result.kept += pending.length - i;
      break;
    }
    if (playedAt === "gone" || (playedAt !== null && playedAt > entry.recordedAt)) {
      drop(itemId, entry.recordedAt);
      result.dropped++;
      continue;
    }
    // Relu juste avant l'envoi : une lecture du titre a pu commencer entre-temps.
    const current = readPlaybackOutbox()[itemId];
    if (!current || current.recordedAt !== entry.recordedAt || itemId === liveItemId) continue;
    if (await deps.sendStop(entry.state)) {
      settlePlayback(itemId, entry.recordedAt);
      result.sent++;
    } else {
      countAttempt(itemId, entry.recordedAt);
      result.kept++;
    }
  }
  return result;
}
