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
import { useSyncExternalStore } from "react";
import { launchRedirectOf, launchRedirectPending, NO_LAUNCH_REDIRECT, settleLaunchRedirect, takeLaunchRedirect, type LaunchRedirect } from "./launchRedirect";
import { NOT_IN_OCTAVE, OCTAVE_LAUNCH_READ_KEYS, decideMobileOctaveLaunch, type MobileOctaveLaunch } from "./octaveLaunchRules";

let decided: MobileOctaveLaunch | null = null;
let decision: Promise<MobileOctaveLaunch> | null = null;
/** La redirection du lancement (`launchRedirect.ts`) : un seul départ, puis tranchée. */
let redirect: LaunchRedirect = NO_LAUNCH_REDIRECT;
const redirectListeners = new Set<() => void>();

function setRedirect(next: LaunchRedirect): void {
  if (next === redirect) return;
  redirect = next;
  for (const listener of redirectListeners) listener();
}

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
    setRedirect(launchRedirectOf(launch.inOctave, launch.path));
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
 * La page où arriver au lancement en Octave, UNE fois (`OctaveLaunchRedirect`,
 * racine) ; null ensuite, ou si l'app s'est ouverte ailleurs (`atEntry` faux).
 */
export function takeOctaveLaunchRedirect(atEntry: boolean): string | null {
  const { next, go } = takeLaunchRedirect(redirect, atEntry);
  setRedirect(next);
  return go;
}

/** Octave atteint (sa coquille montée) ou quitté : la redirection du lancement est tranchée pour de bon. */
export function markOctaveReached(): void {
  setRedirect(settleLaunchRedirect(redirect));
}

function subscribeRedirect(listener: () => void): () => void {
  redirectListeners.add(listener);
  return () => {
    redirectListeners.delete(listener);
  };
}

const redirectPending = (): boolean => launchRedirectPending(redirect);

/** La coquille de Tentacle attend la redirection du lancement (ne rien peindre, ne rien demander). */
export function useOctaveLaunchRedirectPending(): boolean {
  return useSyncExternalStore(subscribeRedirect, redirectPending, redirectPending);
}
