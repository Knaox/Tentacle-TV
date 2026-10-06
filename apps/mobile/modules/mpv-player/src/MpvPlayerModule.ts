import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { DisplayModeInfo } from "@tentacle-tv/shared";

interface MpvNativeLogEvent {
  message: string;
  type: string;
}

type MpvPlayerModuleEvents = {
  onNativeLog: (event: MpvNativeLogEvent) => void;
};

// `declare class` et non `interface` : c'est la forme que le type
// `NativeModule` d'expo-modules-core sait étendre.
declare class MpvPlayerNativeModule extends NativeModule<MpvPlayerModuleEvents> {
  isAirPlayRouteActive(): boolean;
  supportsAv1HardwareDecode(): boolean;
  isSimulator(): boolean;
  /** Android seulement. */
  getDisplayModes?(): DisplaySnapshot;
  setPreferredDisplayMode?(modeId: number): Promise<void>;
}

/** L'écran de l'activité, tel qu'Android le décrit (cf. `DisplayModeBridge.kt`). */
export interface DisplaySnapshot {
  sdk: number;
  currentModeId?: number;
  modes: DisplayModeInfo[];
  /** Fréquences joignables sans coupure depuis le mode courant (Android 12+), sinon absent. */
  seamlessRefreshRates?: number[] | null;
  /** Préférence système « Adapter la fréquence » (Android 12+ ; « always » avant). */
  matchPreference?: "always" | "seamless" | "never";
}

// Chargé en optionnel : sans le module (Android tant que sa moitié n'est pas
// livrée, ancien build), le routeur ne propose jamais le lecteur avancé et
// tout le reste marche.
const native = requireOptionalNativeModule<MpvPlayerNativeModule>("MpvPlayer");

/** Le lecteur avancé existe-t-il dans ce binaire ? */
export function isMpvAvailable(): boolean {
  return native !== null;
}

/** La sortie audio courante est-elle un récepteur AirPlay ? */
export function isAirPlayRouteActive(): boolean {
  try {
    return native?.isAirPlayRouteActive() ?? false;
  } catch {
    return false;
  }
}

/** AV1 décodé par la puce (A17 Pro et plus) ; ailleurs dav1d en logiciel. */
export function supportsAv1HardwareDecode(): boolean {
  try {
    return native?.supportsAv1HardwareDecode() ?? false;
  } catch {
    return false;
  }
}

export function isMpvSimulator(): boolean {
  try {
    return native?.isSimulator() ?? false;
  } catch {
    return false;
  }
}

/** Le journal natif, ligne par ligne, tant que quelqu'un écoute. */
export function addMpvLogListener(
  listener: (event: MpvNativeLogEvent) => void,
): { remove: () => void } | null {
  if (native === null) return null;
  return native.addListener("onNativeLog", listener);
}

/** Android : les modes de l'écran ; `null` ailleurs ou sans le module. */
export function getDisplayModes(): DisplaySnapshot | null {
  if (Platform.OS !== "android") return null;
  try {
    return native?.getDisplayModes?.() ?? null;
  } catch {
    return null;
  }
}

/** Android : pose le mode de la fenêtre (0 = le rendre). Sans effet ailleurs. */
export function setPreferredDisplayMode(modeId: number): void {
  if (Platform.OS !== "android") return;
  native?.setPreferredDisplayMode?.(modeId)?.catch(() => {});
}
