import { createHash } from "crypto";
import type { PlaybackReporter } from "./playbackReporter";
import type {
  PlaybackEventDto,
  PlaybackStateDto,
  SessionPlaystateCommandDto,
  SessionServerMessage,
} from "./protocolMessages";

/**
 * Le registre du canal de session : quelles connexions de lecteurs, sur quels
 * appareils Jellyfin, avec quelle lecture en cours.
 *
 * Un APPAREIL, ici, c'est un jeton Jellyfin : c'est lui qui désigne la
 * session chez Jellyfin (voir `jellyfinCalls.ts`). Deux onglets d'un même
 * navigateur partagent le cookie, donc le jeton, donc la connexion Jellyfin.
 *
 * L'ordre qui compte, à la disparition d'un lecteur : l'arrêt de sa lecture
 * part D'ABORD, la connexion Jellyfin ne se ferme qu'ENSUITE — Jellyfin retire
 * une session sans rien rapporter de sa lecture (`deviceSocket.ts`).
 */

/** Un lecteur qui revient dans ce délai (coupure réseau, socket rouverte) reprend sa lecture sans arrêt. */
export const RECONNECT_GRACE_MS = 5_000;

/** Ce que le registre attend d'une connexion `/api/ws`. */
export interface ChannelConnection {
  readonly userId: string;
  readonly username: string;
  send(msg: SessionServerMessage): void;
}

/** Ce que le registre attend de la connexion Jellyfin d'un appareil. */
export interface DeviceLink {
  isLive(): boolean;
  open(): void;
  close(): void;
}

export interface DeviceHandlers {
  onOpen(): void;
  onLost(): void;
  onPlaystate(command: SessionPlaystateCommandDto, seekPositionTicks?: number): void;
  onGeneralCommand(name: string, args: Record<string, string>): void;
}

export interface RegistryDeps {
  enabled(): boolean;
  resolveToken(conn: ChannelConnection, authToken: string): Promise<string | null>;
  createDevice(token: string, handlers: DeviceHandlers): DeviceLink;
  createReporter(token: string): PlaybackReporter;
}

interface ConnectionEntry {
  conn: ChannelConnection;
  device: DeviceEntry | null;
  deviceId: string | undefined;
  reporter: PlaybackReporter | null;
  connectedAt: number;
}

interface Orphan {
  reporter: PlaybackReporter;
  timer: ReturnType<typeof setTimeout>;
}

interface DeviceEntry {
  key: string;
  token: string;
  link: DeviceLink;
  connections: Set<ConnectionEntry>;
  orphans: Set<Orphan>;
  openedOnce: boolean;
}

/** Ce que le tableau de bord voit d'une connexion. */
export interface ConnectionView {
  userId: string;
  username: string;
  deviceId: string | undefined;
  remoteControl: boolean;
  connectedAt: number;
  playback: PlaybackStateDto | null;
}

function keyOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function samePlayback(reporter: PlaybackReporter, state: PlaybackStateDto): boolean {
  const current = reporter.current();
  return current !== null && current.itemId === state.itemId && (current.playSessionId ?? "") === (state.playSessionId ?? "");
}

export class SessionRegistry {
  private readonly connections = new Map<ChannelConnection, ConnectionEntry>();
  private readonly devices = new Map<string, DeviceEntry>();

  constructor(private readonly deps: RegistryDeps) {}

  /** `session:hello` — rattache la connexion à la connexion Jellyfin de son appareil. */
  async hello(conn: ChannelConnection, authToken: string, deviceId?: string): Promise<void> {
    const entry = this.entryOf(conn);
    entry.deviceId = deviceId;
    const token = this.deps.enabled() ? await this.deps.resolveToken(conn, authToken) : null;
    if (!this.connections.has(conn)) return; // partie pendant la résolution
    const key = token === null ? null : keyOf(token);
    if (entry.device !== null && entry.device.key !== key) this.detach(entry);
    if (token === null || key === null) {
      conn.send({ type: "session:ready", reporting: false, remoteControl: false });
      return;
    }
    const device = entry.device ?? this.deviceFor(key, token);
    entry.device = device;
    device.connections.add(entry);
    conn.send({ type: "session:ready", reporting: true, remoteControl: device.link.isLive() });
  }

  async start(conn: ChannelConnection, state: PlaybackStateDto, resumed: boolean): Promise<void> {
    const entry = this.connections.get(conn);
    const device = entry?.device;
    if (!entry || !device) return;
    // Le même lecteur revenu dans le délai de grâce reprend SA lecture, sans
    // qu'un arrêt puis un début ne partent chez Jellyfin.
    for (const orphan of device.orphans) {
      if (!samePlayback(orphan.reporter, state)) continue;
      clearTimeout(orphan.timer);
      device.orphans.delete(orphan);
      if (entry.reporter !== null && entry.reporter !== orphan.reporter) await entry.reporter.stop();
      entry.reporter = orphan.reporter;
      break;
    }
    entry.reporter ??= this.deps.createReporter(device.token);
    await entry.reporter.start(state, resumed);
  }

  progress(conn: ChannelConnection, event: PlaybackEventDto, state: PlaybackStateDto): void {
    const entry = this.connections.get(conn);
    if (!entry?.device) return;
    if (entry.reporter === null) {
      void this.start(conn, state, true);
      return;
    }
    entry.reporter.progress(event, state);
  }

  async stop(conn: ChannelConnection, state: PlaybackStateDto, requestId: string): Promise<void> {
    const entry = this.connections.get(conn);
    const ok = entry?.reporter ? await entry.reporter.stop(state) : true;
    conn.send({ type: "playback:stopped", requestId, ok });
  }

  /** La connexion `/api/ws` s'est fermée — lecteur parti, planté, ou réseau coupé. */
  closed(conn: ChannelConnection): void {
    const entry = this.connections.get(conn);
    if (!entry) return;
    this.connections.delete(conn);
    this.detach(entry);
  }

  /** Ce que voit le tableau de bord : une ligne par connexion rattachée. */
  list(): ConnectionView[] {
    return [...this.connections.values()]
      .filter((e) => e.device !== null)
      .map((e) => ({
        userId: e.conn.userId,
        username: e.conn.username,
        deviceId: e.deviceId,
        remoteControl: e.device?.link.isLive() ?? false,
        connectedAt: e.connectedAt,
        playback: e.reporter?.current() ?? null,
      }));
  }

  private entryOf(conn: ChannelConnection): ConnectionEntry {
    let entry = this.connections.get(conn);
    if (!entry) {
      entry = { conn, device: null, deviceId: undefined, reporter: null, connectedAt: Date.now() };
      this.connections.set(conn, entry);
    }
    return entry;
  }

  /** Détache une connexion de son appareil ; sa lecture devient orpheline le temps de la grâce. */
  private detach(entry: ConnectionEntry): void {
    const device = entry.device;
    entry.device = null;
    const reporter = entry.reporter;
    entry.reporter = null;
    if (device === null) return;
    device.connections.delete(entry);
    if (reporter?.isActive()) {
      const orphan: Orphan = {
        reporter,
        timer: setTimeout(() => {
          void reporter.stop().finally(() => {
            device.orphans.delete(orphan);
            this.releaseIfIdle(device);
          });
        }, RECONNECT_GRACE_MS),
      };
      device.orphans.add(orphan);
      return;
    }
    this.releaseIfIdle(device);
  }

  /** Plus personne, plus rien en suspens : Jellyfin retire la session. */
  private releaseIfIdle(device: DeviceEntry): void {
    if (device.connections.size > 0 || device.orphans.size > 0) return;
    if (this.devices.get(device.key) !== device) return;
    this.devices.delete(device.key);
    device.link.close();
  }

  private deviceFor(key: string, token: string): DeviceEntry {
    const existing = this.devices.get(key);
    if (existing) return existing;
    const handlers: DeviceHandlers = {
      onOpen: () => {
        this.broadcast(device, true);
        // Une connexion qui RENAÎT (Jellyfin redémarré) : il a pu tout oublier.
        if (device.openedOnce) for (const e of device.connections) e.reporter?.resync();
        device.openedOnce = true;
      },
      onLost: () => this.broadcast(device, false),
      onPlaystate: (command, seekPositionTicks) => {
        for (const e of this.targets(device)) {
          e.conn.send({ type: "session:command", command, seekPositionTicks });
        }
      },
      onGeneralCommand: (name, args) => {
        for (const e of this.targets(device)) e.conn.send(generalMessage(name, args));
      },
    };
    const device: DeviceEntry = {
      key,
      token,
      link: this.deps.createDevice(token, handlers),
      connections: new Set(),
      orphans: new Set(),
      openedOnce: false,
    };
    this.devices.set(key, device);
    device.link.open();
    return device;
  }

  private broadcast(device: DeviceEntry, remoteControl: boolean): void {
    for (const e of device.connections) {
      e.conn.send({ type: "session:ready", reporting: true, remoteControl });
    }
  }

  /** Une commande vise le lecteur qui LIT ; à défaut, tous ceux de l'appareil. */
  private targets(device: DeviceEntry): ConnectionEntry[] {
    const all = [...device.connections];
    const playing = all.filter((e) => e.reporter?.isActive());
    return playing.length > 0 ? playing : all;
  }
}

/** `GeneralCommand` de Jellyfin → message du canal. */
export function generalMessage(name: string, args: Record<string, string>): SessionServerMessage {
  if (name === "DisplayMessage") {
    const timeout = Number(args.TimeoutMs);
    return {
      type: "session:message",
      header: (args.Header ?? "").slice(0, 200),
      text: (args.Text ?? "").slice(0, 2_000),
      ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: Math.min(timeout, 600_000) } : {}),
    };
  }
  return { type: "session:general", name, arguments: args };
}
