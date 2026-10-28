/**
 * Octave (mobile) — le lancement, décidé UNE fois par chargement du JavaScript,
 * avant l'hydratation du stockage : les clés du mode sont lues directement sur
 * le disque (comme les réglages de l'ouverture, `bootIntro/bootPlan.ts`). Un
 * lancement dans Octave lance aussitôt la lecture du cache gardé : quand la
 * coquille se monte, les pages sont déjà là.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { preloadOctaveCache } from "@tentacle-tv/api-client";
import "../cache/sqliteOctaveCache";
import { NOT_IN_OCTAVE, OCTAVE_LAUNCH_READ_KEYS, decideMobileOctaveLaunch, type MobileOctaveLaunch } from "./octaveLaunchRules";

let decided: MobileOctaveLaunch | null = null;
let decision: Promise<MobileOctaveLaunch> | null = null;
let decidedAt = 0;
/** La coquille d'Octave est montée (ou Tentacle a pris la main) : la redirection du lancement ne vaut plus. */
let reached = false;

/** Au-delà, la redirection du lancement ne vaut plus (lien profond ouvert ailleurs, puis retour aux films). */
export const OCTAVE_REDIRECT_WINDOW_MS = 10_000;

async function decide(): Promise<MobileOctaveLaunch> {
  try {
    const pairs = await AsyncStorage.multiGet([...OCTAVE_LAUNCH_READ_KEYS]);
    return decideMobileOctaveLaunch(Object.fromEntries(pairs), Date.now());
  } catch {
    return NOT_IN_OCTAVE;
  }
}

/** LA décision du lancement (une fois). Partie dès le chargement de ce module. */
export function octaveLaunchDecision(): Promise<MobileOctaveLaunch> {
  decision ??= decide().then((launch) => {
    decided = launch;
    decidedAt = Date.now();
    if (launch.inOctave) void preloadOctaveCache();
    return launch;
  });
  return decision;
}

void octaveLaunchDecision();

/** La décision, une fois prise (avant : hors d'Octave). */
export function octaveLaunch(): MobileOctaveLaunch {
  return decided ?? NOT_IN_OCTAVE;
}

/**
 * La page où arriver au lancement en Octave : la première coquille de Tentacle
 * montée y renvoie au lieu de se peindre. Elle vaut jusqu'à ce qu'Octave soit
 * atteint (`markOctaveReached`) — jamais consommée par une simple lecture : le
 * mode strict de React rejoue les initialisations.
 */
export function pendingOctaveLaunchRedirect(now: number = Date.now()): string | null {
  if (reached || !decided?.inOctave || !decided.path) return null;
  return now - decidedAt <= OCTAVE_REDIRECT_WINDOW_MS ? decided.path : null;
}

export function markOctaveReached(): void {
  reached = true;
}
