import WebSocket from "ws";
import { deviceAuthHeader, type DeviceAuth } from "./deviceAuth";
import type { SessionPlaystateCommandDto } from "./protocolMessages";

/**
 * La connexion Jellyfin d'UN appareil, tenue par le backend en son nom.
 *
 * Deux choses n'existent chez Jellyfin que si l'appareil a une connexion
 * ouverte (`WebSocketController`, 10.11) :
 *
 *  - la TÉLÉCOMMANDE : sans contrôleur actif, `SupportsRemoteControl` reste
 *    faux, et le tableau de bord n'offre ni stop, ni pause, ni message ;
 *  - la FIN DE SESSION : à la fermeture de la dernière connexion, Jellyfin
 *    retire la session sur-le-champ (`CloseIfNeededAsync`) — au lieu de la
 *    laisser « en lecture » jusqu'à sa minuterie d'inactivité.
 *
 * ⚠️ Retirer n'est pas arrêter : `OnSessionEnded` ne rapporte AUCUN arrêt de
 * lecture (ni position, ni évènement). L'arrêt se poste donc AVANT de fermer —
 * c'est le registre qui tient cet ordre.
 *
 * L'en-tête ne porte que le jeton, pour la raison dite dans `jellyfinCalls.ts` :
 * la session rattachée est celle du jeton, jamais une qu'un client aurait
 * nommée.
 */

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
/** `ForceKeepAlive` annonce 60 s : on parle deux fois par fenêtre. */
const KEEP_ALIVE_MS = 30_000;
/** Jellyfin répond à chaque KeepAlive : trois silences = socket morte (même règle que `jellyfinWs.ts`). */
const SILENCE_MAX_MS = 95_000;
const WATCHDOG_MS = 15_000;

const PLAYSTATE_COMMANDS: ReadonlySet<string> = new Set<SessionPlaystateCommandDto>([
  "Stop", "Pause", "Unpause", "PlayPause", "Seek", "NextTrack", "PreviousTrack", "Rewind", "FastForward",
]);

/** Ce dont la socket a besoin d'une connexion WebSocket — `ws` en production, un faux en test. */
export interface SocketLike {
  readonly readyState: number;
  on(event: "open" | "close" | "pong", listener: () => void): unknown;
  on(event: "message", listener: (data: WebSocket.RawData) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  send(data: string): void;
  ping(): void;
  terminate(): void;
  close(): void;
  removeAllListeners(): unknown;
}

export interface DeviceSocketOptions {
  /** Base HTTP de Jellyfin (interne), lue à chaque connexion. */
  baseUrl: () => string | undefined;
  /** Le jeton, et l'identité de l'appareil jumelé quand c'est à nous de la présenter. */
  auth: DeviceAuth;
  /** Capacités de l'appareil, postées à chaque ouverture (voir `jellyfinCalls.ts`). */
  postCapabilities: () => Promise<boolean>;
  onOpen: () => void;
  onLost: () => void;
  onPlaystate: (command: SessionPlaystateCommandDto, seekPositionTicks?: number) => void;
  onGeneralCommand: (name: string, args: Record<string, string>) => void;
  createSocket?: (url: string, headers: Record<string, string>) => SocketLike;
}

const OPEN = 1;

function defaultSocket(url: string, headers: Record<string, string>): SocketLike {
  return new WebSocket(url, { headers }) as unknown as SocketLike;
}

function stringArgs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return out;
}

export class DeviceSocket {
  private socket: SocketLike | null = null;
  private closed = false;
  private live = false;
  private backoff = INITIAL_BACKOFF_MS;
  private lastMessageAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: DeviceSocketOptions) {}

  /** Ouverte ET capacités postées : la télécommande est possible. */
  isLive(): boolean {
    return this.live;
  }

  open(): void {
    this.closed = false;
    this.connect();
  }

  /** Fermeture délibérée : Jellyfin retire la session, plus de reconnexion. */
  close(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.teardown();
  }

  private connect(): void {
    if (this.closed || this.socket !== null) return;
    const base = this.opts.baseUrl();
    if (!base) {
      this.scheduleReconnect();
      return;
    }
    const url = `${base.replace(/^http/, "ws").replace(/\/$/, "")}/socket`;
    let socket: SocketLike;
    try {
      socket = (this.opts.createSocket ?? defaultSocket)(url, { Authorization: deviceAuthHeader(this.opts.auth) });
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    const mine = (): boolean => this.socket === socket;

    socket.on("open", () => {
      if (!mine()) return;
      this.backoff = INITIAL_BACKOFF_MS;
      this.lastMessageAt = Date.now();
      this.keepAliveTimer = setInterval(() => {
        if (socket.readyState !== OPEN) return;
        socket.send(JSON.stringify({ MessageType: "KeepAlive" }));
        socket.ping();
      }, KEEP_ALIVE_MS);
      this.watchdogTimer = setInterval(() => {
        if (mine() && Date.now() - this.lastMessageAt > SILENCE_MAX_MS) socket.terminate();
      }, WATCHDOG_MS);
      // Les capacités AVANT d'annoncer la connexion : sans elles, Jellyfin
      // n'offre aucune télécommande, socket ouverte ou non.
      void this.opts.postCapabilities().finally(() => {
        if (!mine() || socket.readyState !== OPEN) return;
        this.live = true;
        this.opts.onOpen();
      });
    });
    socket.on("message", (data) => {
      if (mine()) this.handleMessage(String(data));
    });
    socket.on("pong", () => {
      if (mine()) this.lastMessageAt = Date.now();
    });
    socket.on("close", () => {
      if (!mine()) return;
      this.teardown();
      this.scheduleReconnect();
    });
    socket.on("error", () => {
      /* `close` suit, et c'est lui qui décide */
    });
  }

  private handleMessage(raw: string): void {
    this.lastMessageAt = Date.now();
    let msg: { MessageType?: unknown; Data?: unknown };
    try {
      msg = JSON.parse(raw) as typeof msg;
    } catch {
      return;
    }
    const data = (msg.Data ?? {}) as Record<string, unknown>;
    switch (msg.MessageType) {
      case "ForceKeepAlive":
        if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify({ MessageType: "KeepAlive" }));
        break;
      case "Playstate": {
        const command = data.Command;
        if (typeof command !== "string" || !PLAYSTATE_COMMANDS.has(command)) return;
        const seek = data.SeekPositionTicks;
        this.opts.onPlaystate(
          command as SessionPlaystateCommandDto,
          typeof seek === "number" && Number.isFinite(seek) && seek >= 0 ? seek : undefined,
        );
        break;
      }
      case "GeneralCommand": {
        if (typeof data.Name !== "string") return;
        this.opts.onGeneralCommand(data.Name, stringArgs(data.Arguments));
        break;
      }
      default:
        // KeepAlive, UserDataChanged, SyncPlay… : rien à relayer.
        break;
    }
  }

  private teardown(): void {
    if (this.keepAliveTimer !== null) clearInterval(this.keepAliveTimer);
    if (this.watchdogTimer !== null) clearInterval(this.watchdogTimer);
    this.keepAliveTimer = null;
    this.watchdogTimer = null;
    const socket = this.socket;
    this.socket = null;
    const wasLive = this.live;
    this.live = false;
    if (socket !== null) {
      socket.removeAllListeners();
      // Un écouteur d'erreur reste posé : `ws` lève sinon sur une erreur tardive.
      socket.on("error", () => undefined);
      if (socket.readyState === OPEN) socket.close();
      else socket.terminate();
    }
    if (wasLive) this.opts.onLost();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
