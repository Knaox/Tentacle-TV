import { NativeModules } from "react-native";

/**
 * Le « ta-dum » de l'ouverture, par le module natif `TentacleBootSound`
 * (ios/TentacleTV/TentacleBootSound.m : AVAudioPlayer, catégorie « ambient »).
 * L'heure demandée est celle des images (ms, horloge du CADisplayLink, celle
 * que l'horloge Reanimated de l'ouverture lit) ; le module la tient à la
 * milliseconde. Sans module (un test, une app d'avant), rien ne se joue.
 * Le jumeau `bootSound.android.ts` ne joue rien : Android TV n'a pas encore
 * l'ouverture.
 */
interface NativeBootSound {
  prepare(): Promise<{ ready: boolean; now?: number }>;
  playAt(hostMs: number): void;
  fadeOut(ms: number): void;
  dispose(): void;
}

const native = (NativeModules as { TentacleBootSound?: NativeBootSound }).TentacleBootSound ?? null;

export const bootSound = {
  /** Décode le fichier d'avance ; vrai s'il est prêt. */
  async prepare(): Promise<boolean> {
    if (!native) return false;
    try {
      return (await native.prepare()).ready;
    } catch {
      return false;
    }
  },
  playAt(hostMs: number): void {
    native?.playAt(hostMs);
  },
  fadeOut(ms: number): void {
    native?.fadeOut(ms);
  },
  dispose(): void {
    native?.dispose();
  },
};
