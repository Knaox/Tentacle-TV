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
let redirectTaken = false;

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

/** La page où arriver, UNE fois : la première coquille de Tentacle montée y renvoie au lieu de se peindre. */
export function takeOctaveLaunchRedirect(): string | null {
  if (redirectTaken || !decided?.inOctave || !decided.path) return null;
  redirectTaken = true;
  return decided.path;
}
