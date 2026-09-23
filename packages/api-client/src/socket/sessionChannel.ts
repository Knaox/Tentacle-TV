import {
  SESSION_CHANNEL_VERSION,
  type PlaybackEventDto,
  type PlaybackStateDto,
  type SessionPlaystateCommandDto,
  type WsServerMessage,
} from "@tentacle-tv/shared";
import { onSocketStatus, sendSocketMessage, subscribeSocket } from "./tentacleSocket";

/**
 * Canal de session, côté lecteur — voir `sessionChannelMessages.ts` pour le
 * principe. Il vit sur le socket Tentacle partagé : il ne l'ouvre pas, il
 * s'y annonce (`session:hello`) à chaque authentification.
 *
 * Opt-in : seul un hôte qui appelle `configureSessionChannel` s'annonce (le web
 * et la coquille de bureau). Ailleurs, et face à un serveur qui ne connaît pas
 * le canal (il ne répond rien), `isChannelReporting()` reste faux et les
 * reports continuent de partir en HTTP, comme avant.
 */

export interface ChannelStatus {
  /** Le backend porte la télémétrie de cette connexion. */
  reporting: boolean;
  /** La télécommande de Jellyfin atteint ce lecteur. */
  remoteControl: boolean;
}

export interface SessionCommand {
  command: SessionPlaystateCommandDto;
  seekPositionTicks?: number;
}

export interface SessionGeneral {
  name: string;
  arguments: Record<string, string>;
}

export interface SessionMessage {
  header: string;
  text: string;
  timeoutMs?: number;
}

/** Au-delà, l'arrêt n'est pas confirmé : l'appelant retombe sur le HTTP. */
const STOP_ACK_TIMEOUT_MS = 4_000;

let deviceIdProvider: (() => string) | null = null;
let status: ChannelStatus = { reporting: false, remoteControl: false };
let activePlayback: (() => PlaybackStateDto | null) | null = null;
let requestSeq = 0;
const pendingStops = new Map<string, (ok: boolean) => void>();

const statusListeners = new Set<(s: ChannelStatus) => void>();
const commandListeners = new Set<(c: SessionCommand) => void>();
const generalListeners = new Set<(g: SessionGeneral) => void>();
const messageListeners = new Set<(m: SessionMessage) => void>();

function setStatus(next: ChannelStatus): void {
  const becameReporting = next.reporting && !status.reporting;
  status = next;
  for (const l of [...statusListeners]) l(status);
  // Le canal (r)ouvert en pleine lecture : le backend reprend la lecture en
  // cours sans annoncer un nouveau début chez Jellyfin.
  if (becameReporting) {
    const state = activePlayback?.();
    if (state) sendSocketMessage({ type: "playback:start", state, resumed: true });
  }
}

function handle(msg: WsServerMessage): void {
  switch (msg.type) {
    case "session:ready":
      setStatus({ reporting: msg.reporting, remoteControl: msg.remoteControl });
      break;
    case "session:command":
      for (const l of [...commandListeners]) l({ command: msg.command, seekPositionTicks: msg.seekPositionTicks });
      break;
    case "session:general":
      for (const l of [...generalListeners]) l({ name: msg.name, arguments: msg.arguments });
      break;
    case "session:message":
      for (const l of [...messageListeners]) l({ header: msg.header, text: msg.text, timeoutMs: msg.timeoutMs });
      break;
    case "playback:stopped": {
      const resolve = pendingStops.get(msg.requestId);
      pendingStops.delete(msg.requestId);
      resolve?.(msg.ok);
      break;
    }
    default:
      break;
  }
}

/**
 * Active le canal pour cet hôte. `deviceId` n'est qu'une étiquette de
 * corrélation pour le tableau de bord — le backend ne la présente jamais à
 * Jellyfin. Idempotent.
 */
export function configureSessionChannel(options: { deviceId: () => string }): void {
  const first = deviceIdProvider === null;
  deviceIdProvider = options.deviceId;
  if (!first) return;
  subscribeSocket(handle);
  onSocketStatus((socketStatus) => {
    if (socketStatus === "open") {
      sendSocketMessage({ type: "session:hello", version: SESSION_CHANNEL_VERSION, deviceId: deviceIdProvider?.() });
      return;
    }
    // Socket fermé : plus de canal tant qu'un nouveau `session:ready` n'arrive pas.
    if (status.reporting || status.remoteControl) setStatus({ reporting: false, remoteControl: false });
    for (const resolve of pendingStops.values()) resolve(false);
    pendingStops.clear();
  });
}

export function isChannelReporting(): boolean {
  return status.reporting;
}

export function getChannelStatus(): ChannelStatus {
  return status;
}

/** La lecture en cours, relue à chaque (ré)ouverture du canal. */
export function setActivePlayback(provider: () => PlaybackStateDto | null): void {
  activePlayback = provider;
}

/** Fin de lecture : oublie ce fournisseur — seulement s'il est encore le courant
 *  (un lecteur démonté après le montage du suivant ne doit pas l'effacer). */
export function clearActivePlayback(provider: () => PlaybackStateDto | null): void {
  if (activePlayback === provider) activePlayback = null;
}

/** Début de lecture par le canal ; faux si le canal ne porte pas la télémétrie. */
export function channelStart(state: PlaybackStateDto): boolean {
  return status.reporting && sendSocketMessage({ type: "playback:start", state });
}

export function channelProgress(event: PlaybackEventDto, state: PlaybackStateDto): boolean {
  return status.reporting && sendSocketMessage({ type: "playback:progress", event, state });
}

/**
 * Fin de lecture par le canal. Vrai une fois Jellyfin servi ; faux si le canal
 * ne porte pas la télémétrie, ou sans confirmation à temps — l'appelant poste
 * alors lui-même.
 */
export function channelStop(state: PlaybackStateDto): Promise<boolean> {
  if (!status.reporting) return Promise.resolve(false);
  requestSeq += 1;
  const requestId = `stop-${Date.now().toString(36)}-${requestSeq}`;
  if (!sendSocketMessage({ type: "playback:stop", state, requestId })) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pendingStops.delete(requestId);
      resolve(false);
    }, STOP_ACK_TIMEOUT_MS);
    pendingStops.set(requestId, (ok) => {
      clearTimeout(timer);
      resolve(ok);
    });
  });
}

export function onChannelStatus(listener: (s: ChannelStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

export function onSessionCommand(listener: (c: SessionCommand) => void): () => void {
  commandListeners.add(listener);
  return () => commandListeners.delete(listener);
}

export function onSessionGeneral(listener: (g: SessionGeneral) => void): () => void {
  generalListeners.add(listener);
  return () => generalListeners.delete(listener);
}

export function onSessionMessage(listener: (m: SessionMessage) => void): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}
