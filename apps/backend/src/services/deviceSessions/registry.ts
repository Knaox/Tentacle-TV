import type { DeviceAuth } from "./deviceAuth";
import type { PlaybackReporter } from "./playbackReporter";
import type {
  PlaybackEventDto,
  PlaybackStateDto,
  SessionPlaystateCommandDto,
  SessionServerMessage,
} from "./protocolMessages";
import { generalMessage } from "./generalMessage";
import { keyOf, samePlayback } from "./registryKeys";

export { generalMessage };

/**
 * Le registre du canal de session : quelles connexions de lecteurs, sur quels
 * appareils Jellyfin, avec quelle lecture en cours.
 *
 * Un APPAREIL, ici, c'est un jeton Jellyfin — et, pour un appareil jumelé,
 * l'identité que le serveur présente pour lui (`deviceAuth.ts`) : c'est ce
 * couple qui désigne la session chez Jellyfin. Deux onglets d'un même
 * navigateur partagent le cookie, donc le jeton, donc la connexion Jellyfin ;
 * deux TV d'un compte qui partagent un jeton restent deux appareils.
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

/** Ce que dit `session:hello` : une étiquette, et le nom d'une application jumelée. */
export interface HelloInfo {
  deviceId?: string;
  client?: string;
  device?: string;
  appVersion?: string;
}

export interface RegistryDeps {
  enabled(): boolean;
  resolveAuth(conn: ChannelConnection, authToken: string, hello: HelloInfo): Promise<DeviceAuth | null>;
  createDevice(auth: DeviceAuth, handlers: DeviceHandlers): DeviceLink;
  createReporter(auth: DeviceAuth): PlaybackReporter;
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
  auth: DeviceAuth;
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

export class SessionRegistry {
  private readonly connections = new Map<ChannelConnection, ConnectionEntry>();
  private readonly devices = new Map<string, DeviceEntry>();

  constructor(private readonly deps: RegistryDeps) {}

  /** `session:hello` — rattache la connexion à la connexion Jellyfin de son appareil. */
  async hello(conn: ChannelConnection, authToken: string, hello: HelloInfo = {}): Promise<void> {
    const entry = this.entryOf(conn);
    entry.deviceId = hello.deviceId;
    const auth = this.deps.enabled() ? await this.deps.resolveAuth(conn, authToken, hello) : null;
    if (!this.connections.has(conn)) return; // partie pendant la résolution
    const key = auth === null ? null : keyOf(auth);
    if (entry.device !== null && entry.device.key !== key) this.detach(entry);
    if (auth === null || key === null) {
      conn.send({ type: "session:ready", reporting: false, remoteControl: false });
      return;
    }
    // Un appareil jumelé est connu de Jellyfin sous l'identifiant dérivé :
    // c'est celui-là que le tableau de bord rapproche de la session.
    if (auth.identity) entry.deviceId = auth.identity.deviceId;
    const device = entry.device ?? this.deviceFor(key, auth);
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
    entry.reporter ??= this.deps.createReporter(device.auth);
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

  /**
   * Un appareil jumelé vient d'être RÉVOQUÉ : il ne reviendra pas, pas de
   * grâce. Ses lectures s'arrêtent tout de suite — l'arrêt part tant que son
   * jeton vaut encore, la position est gardée —, puis sa connexion Jellyfin
   * se ferme.
   */
  async end(jellyfinDeviceId: string): Promise<void> {
    for (const device of [...this.devices.values()]) {
      if (device.auth.identity?.deviceId !== jellyfinDeviceId) continue;
      this.devices.delete(device.key);
      const reporters: PlaybackReporter[] = [];
      for (const entry of device.connections) {
        if (entry.reporter) reporters.push(entry.reporter);
        entry.reporter = null;
        entry.device = null;
      }
      for (const orphan of device.orphans) {
        clearTimeout(orphan.timer);
        reporters.push(orphan.reporter);
      }
      device.connections.clear();
      device.orphans.clear();
      await Promise.all(reporters.map((r) => r.stop().catch(() => false)));
      device.link.close();
    }
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

  private deviceFor(key: string, auth: DeviceAuth): DeviceEntry {
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
      auth,
      link: this.deps.createDevice(auth, handlers),
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
