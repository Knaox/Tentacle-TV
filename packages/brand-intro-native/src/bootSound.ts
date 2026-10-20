import { NativeModules } from "react-native";

/**
 * Le « ta-dum » de l'ouverture, par le module natif `TentacleBootSound`, le
 * même contrat sur les deux plateformes — et le même CODE pour la TV et le
 * mobile : iOS / tvOS (apps/tv/ios/TentacleTV/TentacleBootSound.m :
 * AVAudioPlayer, catégorie « ambient ») et Android (apps/tv/android/…/boot/ :
 * PCM décodé d'avance, flux calé sur la sortie, sans focus audio), que le
 * projet mobile compile tels quels. L'heure demandée est celle des images
 * (ms, horloge que l'horloge Reanimated de l'ouverture lit : CADisplayLink,
 * Choreographer) ; le module la tient à la milliseconde. Sans module (un test,
 * une app d'avant), rien ne se joue.
 */
interface NativeBootSound {
  claimIntro(): boolean;
  prepare(): Promise<{ ready: boolean; now?: number; outputLeadMs?: number }>;
  playAt(hostMs: number): void;
  fadeOut(ms: number): void;
  dispose(): void;
}

const native = (NativeModules as { TentacleBootSound?: NativeBootSound }).TentacleBootSound ?? null;

type Prepared = { ready: boolean; outputLeadMs: number | null };
/** La préparation en cours ou faite : une seule par processus (le mobile la lance dès sa décision). */
let preparing: Promise<Prepared> | null = null;

async function prepareOnce(): Promise<Prepared> {
  if (!native) return { ready: false, outputLeadMs: null };
  try {
    const result = await native.prepare();
    return { ready: result.ready, outputLeadMs: typeof result.outputLeadMs === "number" ? result.outputLeadMs : null };
  } catch {
    return { ready: false, outputLeadMs: null };
  }
}

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
  /**
   * Décode le fichier d'avance. `outputLeadMs` : l'avance de la sortie, que le
   * son doit précéder (Android TV la mesure ; null : l'Apple TV, rien à mesurer).
   * Un second appel rend la MÊME préparation : le mobile la lance dès que
   * l'ouverture est décidée, le déroulé la reprend au montage.
   */
  prepare(): Promise<Prepared> {
    preparing ??= prepareOnce();
    return preparing;
  },
  playAt(hostMs: number): void {
    native?.playAt(hostMs);
  },
  fadeOut(ms: number): void {
    native?.fadeOut(ms);
  },
  dispose(): void {
    preparing = null;
    native?.dispose();
  },
};
