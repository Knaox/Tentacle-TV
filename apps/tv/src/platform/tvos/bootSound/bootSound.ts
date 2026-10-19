import { NativeModules } from "react-native";

/**
 * Le « ta-dum » de l'ouverture, par le module natif `TentacleBootSound`, le
 * même contrat sur les deux plateformes : tvOS
 * (ios/TentacleTV/TentacleBootSound.m : AVAudioPlayer, catégorie « ambient »)
 * et Android TV (android/…/boot/BootSoundModule.kt : PCM décodé d'avance,
 * AudioTrack statique, sans focus audio). L'heure demandée est celle des images
 * (ms, horloge que l'horloge Reanimated de l'ouverture lit : CADisplayLink,
 * Choreographer) ; le module la tient à la milliseconde. Sans module (un test,
 * une app d'avant), rien ne se joue.
 */
interface NativeBootSound {
  claimIntro(): boolean;
  prepare(): Promise<{ ready: boolean; now?: number }>;
  playAt(hostMs: number): void;
  fadeOut(ms: number): void;
  dispose(): void;
}

const native = (NativeModules as { TentacleBootSound?: NativeBootSound }).TentacleBootSound ?? null;

export const bootSound = {
  /**
   * La mémoire du processus (tv-core `bootIntroOnce`) : vrai au premier appel
   * du PROCESSUS, faux ensuite — un rechargement du JavaScript n'y change rien.
   * Sans module natif : null (l'appelant garde sa mémoire JavaScript).
   */
  claimIntro(): boolean | null {
    if (!native) return null;
    try {
      return native.claimIntro() === true;
    } catch {
      return null;
    }
  },
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
