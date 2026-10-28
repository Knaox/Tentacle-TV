import { NativeModule, requireOptionalNativeModule } from "expo";
import { AUDIO_BRIDGE_EVENT, type AudioBridgeEvent, type NativeBridge } from "@tentacle-tv/shared/octave";

/** Une seule forme d'évènement : l'évènement du pont, sérialisé (`AudioBridgeEvent`). */
interface OctaveAudioNativeEvent {
  json: string;
}

type OctaveAudioModuleEvents = {
  onBridgeEvent: (event: OctaveAudioNativeEvent) => void;
};

// `declare class` et non `interface` : c'est la forme que le type
// `NativeModule` d'expo-modules-core sait étendre.
declare class OctaveAudioNativeModule extends NativeModule<OctaveAudioModuleEvents> {
  /** Une commande du pont (`AUDIO_BRIDGE_COMMANDS`), arguments et réponse en JSON. */
  invoke(command: string, argsJson: string): Promise<string>;
  /** Le module lit un flux DIRECT (`open: "direct"`, sans les en-têtes du serveur, repli `fallbackUrl`). Absent : un build d'avant. */
  readonly directStreams?: boolean;
}

const native = requireOptionalNativeModule<OctaveAudioNativeModule>("OctaveAudio");

export function isOctaveAudioAvailable(): boolean {
  return native !== null;
}

/** Vrai si ce build sait lire un flux direct (requêtes déléguées) ; faux pour un module d'avant. */
export function octaveAudioSupportsDirect(): boolean {
  return native?.directStreams === true;
}

/**
 * Le pont natif sous la forme qu'attend l'adaptateur partagé (`createBridgeAudioEngine`) : les mêmes
 * commandes et le même évènement que la coquille du bureau.
 */
export const octaveAudioBridge: NativeBridge = {
  invoke: async <T>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    if (native === null) throw new Error("octave-audio: module natif absent");
    const raw = await native.invoke(command, JSON.stringify(args));
    return (raw === "" ? undefined : JSON.parse(raw)) as T;
  },
  listen: async <T>(event: string, handler: (e: { payload: T }) => void): Promise<() => void> => {
    if (native === null || event !== AUDIO_BRIDGE_EVENT) return () => undefined;
    const subscription = native.addListener("onBridgeEvent", ({ json }) => {
      try {
        handler({ payload: JSON.parse(json) as T });
      } catch (error) {
        console.warn("[octave-audio] évènement illisible", error);
      }
    });
    return () => subscription.remove();
  },
};

export type { AudioBridgeEvent };
