import { NativeModule, requireOptionalNativeModule } from "expo";

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
