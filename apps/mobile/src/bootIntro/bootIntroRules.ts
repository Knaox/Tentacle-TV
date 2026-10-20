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
 * accueil hors ligne, une fiche, « Qui regarde ? » — monté une fois sa liste
 * arrivée) est prêt dès qu'il est monté.
 */
export const MOBILE_BOOT_SELF_REPORTING: readonly string[] = ["/"];

/**
 * Les recouvrements du démarrage qui REMPLACENT le premier écran (plein écran,
 * montés DANS l'écran du poulpe pendant l'ouverture) : la plongée se fait
 * dans eux, jamais dans l'écran qu'ils cachent. Par priorité : les pages
 * bloquantes (migration de la base, accès suspendu), puis « Qui regarde ? »
 * et son code, puis le premier lancement du profil.
 */
export const BOOT_FIRST_SCREEN_OVERLAYS = ["migration", "access", "profiles", "firstRun"] as const;
export type BootFirstScreenOverlay = (typeof BOOT_FIRST_SCREEN_OVERLAYS)[number];

/** Les pages qui recouvrent tout : l'écran du poulpe s'y allume aussitôt. */
const BLOCKING: readonly BootFirstScreenOverlay[] = ["migration", "access"];

/** Le nom de route que l'ouverture regarde quand un recouvrement est le premier écran. */
export const overlayBootRoute = (overlay: BootFirstScreenOverlay): string => `overlay:${overlay}`;

export interface MobileArrivalInput {
  /** Le stockage est relu et les polices chargées : la navigation est montée. */
  appReady: boolean;
  /** Le chemin expo-router affiché. */
  pathname: string | null | undefined;
  /** Une garde (authentification, hors ligne) va REMPLACER cette route : ce n'est pas le premier écran. */
  redirecting: boolean;
  /** Le mode hors ligne : le catalogue de l'appareil, qui s'affiche aussitôt. */
  offline: boolean;
  /** Ce que DÉCLARENT les hôtes des recouvrements du premier écran (absent : rien à montrer). */
  overlays: BootOverlayStates;
  /** Ceux dont la vue est RÉELLEMENT montée dans l'écran du poulpe (`BootAwareModal`). */
  shown: ReadonlySet<BootFirstScreenOverlay>;
}

export type BootOverlayStates = Partial<Record<BootFirstScreenOverlay, "pending" | "active" | "quiet">>;

export interface MobileArrival {
  /** L'écran dans lequel plonger (null : on ne le sait pas encore). */
  route: string | null;
  /** Un recouvrement n'a pas tranché : attendre (au plus 8 s). */
  pending: boolean;
  /** Une page bloquante, ou le hors ligne : plonger aussitôt. */
  blocked: boolean;
}

/**
 * LE PREMIER ÉCRAN RÉEL, décidé AVANT la plongée : jamais une route qu'une
 * garde va remplacer, jamais l'écran que « Qui regarde ? » ou le premier
 * lancement vont recouvrir — sinon l'écran du poulpe s'allumerait sur un écran
 * remplacé sous les yeux. Module pur, testé.
 */
export function mobileBootArrival(input: MobileArrivalInput): MobileArrival {
  const none: MobileArrival = { route: null, pending: false, blocked: false };
  if (!input.appReady || !input.pathname || input.redirecting) return none;
  // Le plus prioritaire DÉJÀ À L'ÉCRAN : c'est lui qu'on voit, quoi qu'il cache.
  for (const overlay of BOOT_FIRST_SCREEN_OVERLAYS) {
    if (input.shown.has(overlay)) return { route: overlayBootRoute(overlay), pending: false, blocked: BLOCKING.includes(overlay) };
  }
  if (input.offline) return { route: input.pathname, pending: false, blocked: true };
  // Un hôte qui n'a pas tranché, ou qui a décidé de montrer sa vue sans l'avoir encore montée
  // (le premier lancement attend son calme) : l'écran sous lui n'est pas le premier.
  const pending = BOOT_FIRST_SCREEN_OVERLAYS.some((overlay) => {
    const state = input.overlays[overlay];
    return state === "pending" || state === "active";
  });
  return { route: input.pathname, pending, blocked: false };
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
