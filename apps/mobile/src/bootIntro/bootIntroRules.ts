/**
 * Les règles de l'ouverture PROPRES au mobile, autour de celles de shared
 * (`@tentacle-tv/shared/brandIntro` : quand la jouer, quand partir). Module
 * PUR (ni React Native ni Expo) : testé sous vitest.
 */
import { decideBootIntro, type BootIntroPlan } from "@tentacle-tv/shared/brandIntro";
import type { BootIntroSettings } from "./bootIntroSettings";

/**
 * Les écrans du mobile qui disent EUX-MÊMES quand ils sont prêts (leurs
 * données arrivent), par leur chemin expo-router : l'accueil, montré d'un bloc
 * (`HomeScreen`). Tout autre premier écran (connexion, choix du serveur,
 * accueil hors ligne, une fiche) est prêt dès qu'il est monté. « Qui
 * regarde ? » n'en est jamais un : c'est une modale de `FamilyLaunchHosts`,
 * qui s'ouvre APRÈS l'arrivée (`useBootIntroLanded`), sur l'accueil.
 */
export const MOBILE_BOOT_SELF_REPORTING: readonly string[] = ["/"];

/**
 * L'écran que l'ouverture regarde : aucun tant que l'app n'est pas prête
 * (stockage relu, polices chargées — l'app montre encore son attente, et la
 * garde d'authentification n'a pas encore choisi la route), puis son chemin.
 */
export function bootRouteOf(pathname: string | null | undefined, appReady: boolean): string | null {
  if (!appReady || !pathname) return null;
  return pathname;
}

export interface MobileBootInput {
  /** Ce montage est le démarrage à froid du processus (mémoire native). */
  coldStart: boolean;
  /** « Réduire les animations » du système (iOS, Android). */
  reducedMotion: boolean;
  settings: BootIntroSettings;
}

export interface MobileBootPlan {
  plan: BootIntroPlan;
  /** Le « ta-dum » se joue (jamais sans l'animation). */
  sound: boolean;
}

/** Le mobile a l'ouverture partout (iPhone, iPad, Android) : seuls le système et l'appareil la coupent. */
export function mobileBootPlan(input: MobileBootInput): MobileBootPlan {
  const plan = decideBootIntro({
    supported: true,
    enabled: input.settings.intro,
    reducedMotion: input.reducedMotion,
    coldStart: input.coldStart,
  });
  return { plan, sound: plan === "intro" && input.settings.sound };
}
