import type { DeviceAuth } from "./deviceAuth";
import type { PlaybackReporter } from "./playbackReporter";
import type {
  JellyfinHealthState,
  PlaybackStateDto,
  SessionPlaystateCommandDto,
  SessionServerMessage,
} from "./protocolMessages";

/** Les formes que le registre du canal de session (`registry.ts`) attend et rend. */

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
  /** Jellyfin est revenu : rouvrir maintenant, sans attendre le backoff. */
  reconnectNow(): void;
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
  /** L'état de Jellyfin (`jellyfinHealth.ts`), dit à chaque lecteur qui s'annonce. */
  jellyfinHealth(): { state: JellyfinHealthState; since: number };
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
