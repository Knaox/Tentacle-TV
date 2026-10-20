import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** L'état des TV autour : « aucune », « pas reliée », « connexion », « reliée ». */
export type CastAvailability = "unavailable" | "noDevices" | "notConnected" | "connecting" | "connected";

export interface CastStateEvent {
  state: CastAvailability;
  deviceName: string | null;
}

export type CastPlayerState = "idle" | "playing" | "paused" | "buffering" | "loading";

export interface CastStatusEvent {
  playerState: CastPlayerState;
  idleReason: "finished" | "cancelled" | "interrupted" | "error" | null;
  /** Secondes, position du RÉCEPTEUR dans le flux qu'il lit. */
  position: number;
  duration: number;
  /** L'URL du média chargé : un statut d'un autre média se reconnaît. */
  contentId: string | null;
}

export interface CastLoadRequest {
  url: string;
  contentType: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  startSeconds: number;
  durationSeconds: number;
  textTrackUrl?: string;
  textTrackLanguage?: string;
  textTrackName?: string;
}

type CastEvents = {
  onCastState: (event: CastStateEvent) => void;
  onCastStatus: (event: CastStatusEvent) => void;
};

declare class TentacleCastNativeModule extends NativeModule<CastEvents> {
  start(): Promise<boolean>;
  getState(): Promise<CastStateEvent>;
  getStatus(): Promise<CastStatusEvent>;
  showPicker(): Promise<boolean>;
  load(request: CastLoadRequest): Promise<boolean>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  endSession(): Promise<void>;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<TentacleCastNativeModule>("TentacleCast") : null;

const ignore = () => undefined;

export const TentacleCast = {
  /** Démarre Google Cast ; faux sans le module ou sans Google Play services. */
  start: (): Promise<boolean> => native?.start().catch(() => false) ?? Promise.resolve(false),
  getState: (): Promise<CastStateEvent | null> => native?.getState().catch(() => null) ?? Promise.resolve(null),
  getStatus: (): Promise<CastStatusEvent | null> => native?.getStatus().catch(() => null) ?? Promise.resolve(null),
  showPicker: (): void => { native?.showPicker().catch(ignore); },
  load: (request: CastLoadRequest): Promise<boolean> => native?.load(request).catch(() => false) ?? Promise.resolve(false),
  play: (): void => { native?.play().catch(ignore); },
  pause: (): void => { native?.pause().catch(ignore); },
  seek: (seconds: number): void => { native?.seek(seconds).catch(ignore); },
  endSession: (): void => { native?.endSession().catch(ignore); },
  addListener<E extends keyof CastEvents>(event: E, listener: CastEvents[E]): { remove: () => void } | null {
    return native?.addListener(event, listener) ?? null;
  },
};
