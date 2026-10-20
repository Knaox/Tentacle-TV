import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type PlayerPipAction = "play" | "pause" | "rewind" | "forward";

export interface PlayerPipConfig {
  /** Entrer d'elle-même en quittant l'app (lecture en cours seulement). */
  autoEnter: boolean;
  playing: boolean;
  aspectWidth: number;
  aspectHeight: number;
  /** Les libellés des gestes de la fenêtre (accessibilité), traduits. */
  labels: Record<PlayerPipAction, string>;
}

type PlayerPipEvents = {
  onPipModeChanged: (event: { active: boolean }) => void;
  onPipAction: (event: { action: PlayerPipAction }) => void;
  onPipClosed: () => void;
};

declare class PlayerPipNativeModule extends NativeModule<PlayerPipEvents> {
  isSupported(): boolean;
  isActive(): boolean;
  configure(config: PlayerPipConfig): Promise<void>;
  enter(): Promise<boolean>;
  reset(): Promise<void>;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<PlayerPipNativeModule>("PlayerPip") : null;

export function isPlayerPipSupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

export function configurePlayerPip(config: PlayerPipConfig): void {
  native?.configure(config).catch(() => {});
}

export function enterPlayerPip(): Promise<boolean> {
  return native?.enter().catch(() => false) ?? Promise.resolve(false);
}

export function resetPlayerPip(): void {
  native?.reset().catch(() => {});
}

export function addPlayerPipListener<E extends keyof PlayerPipEvents>(
  event: E,
  listener: PlayerPipEvents[E],
): { remove: () => void } | null {
  return native?.addListener(event, listener) ?? null;
}
