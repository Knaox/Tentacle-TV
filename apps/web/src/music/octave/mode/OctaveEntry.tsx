/**
 * Octave — le chargement du mode et la porte de l'accueil : quand le mode est
 * allumé (au lancement par le réglage « Au démarrage, ouvrir », ou en cours de
 * session par la bascule), `/` EST Octave — comme le mode hors ligne remplace
 * l'accueil par le catalogue local.
 *
 * Lancement en Octave (`octaveLaunchStore.ts`) : le module d'Octave et la
 * lecture du cache gardé partent AU CHARGEMENT de ce module ; `main.tsx`
 * attend l'un et l'autre (borné, `bootOctave`) avant la première image, qui
 * est alors la page où l'on était en quittant, avec ses données.
 */

import { Suspense, lazy, useEffect, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { bootOctaveCache } from "../cache/octaveCacheHydration";
import type { OctaveQueryClientLike } from "../data/persist/octaveCachePersister";
import { octaveOwner } from "../cache/octaveOwner";
import { octavePageReached, resumePath, savedOctavePageAtLaunch } from "../cache/pageResume";
import { OCTAVE_BASE_PATH, isOctaveMode, setOctaveMode, useOctaveMode } from "./octaveMode";
import { releaseTentacle, wasLaunchedInOctave } from "./octaveLaunchStore";
import { octaveLanding, tentaclePageEndsMode } from "./octaveStartup";
import { useOctaveLaunchAvailability } from "./useOctaveLaunchAvailability";

type OctaveModule = typeof import("../OctaveApp");
let octaveModule: Promise<OctaveModule> | null = null;
/** Le module, une fois arrivé : rendu tel quel, sans repasser par `lazy`. */
let loadedOctave: OctaveModule | null = null;

/** Le module du mode, chargé UNE fois ; un échec (réseau) se retente au geste suivant. */
export function loadOctaveApp(): Promise<OctaveModule> {
  if (!octaveModule) {
    octaveModule = import("../OctaveApp");
    octaveModule.then(
      (module) => {
        loadedOctave = module;
      },
      () => {
        octaveModule = null;
      },
    );
  }
  return octaveModule;
}

/** Le mode entier, chargé à la demande : rien n'est téléchargé avant d'y entrer. */
export const LazyOctaveApp = lazy(loadOctaveApp);

/**
 * La route d'Octave. `lazy` suspend une fois même quand le module est déjà là
 * (mesuré au bureau : ~110 ms vides au lancement en Octave) : un module arrivé
 * — ce que le démarrage attend (`bootOctave`) — se rend directement.
 */
export function OctaveRoute() {
  if (loadedOctave) return <loadedOctave.OctaveApp />;
  return (
    <Suspense fallback={null}>
      <LazyOctaveApp />
    </Suspense>
  );
}

// Lancement en Octave : le module part AVEC la vérification de la disponibilité,
// pas après — la première image peinte est celle d'Octave. La page gardée est
// lue ICI, avant toute écriture de la session.
const launchPage = wasLaunchedInOctave() ? resumePath(savedOctavePageAtLaunch(), octaveOwner(), Date.now(), OCTAVE_BASE_PATH) : OCTAVE_BASE_PATH;
if (wasLaunchedInOctave()) void loadOctaveApp().catch(() => undefined);

/**
 * Le démarrage, côté Octave (`main.tsx`, avant la première image) : rien hors
 * d'un lancement en Octave ; sinon le module et le cache gardé, attendus au
 * plus `OCTAVE_BOOT_BUDGET_MS`, puis les pages de l'identité rendues au cache.
 */
export function bootOctave(qc: OctaveQueryClientLike): Promise<void> {
  if (!wasLaunchedInOctave()) return Promise.resolve();
  return bootOctaveCache(qc, loadOctaveApp());
}

/**
 * Enveloppe la mise en page de l'application. Sur l'accueil (`/`), mode
 * allumé : rien tant que la disponibilité n'est pas connue (jamais la barre ni
 * l'accueil vidéo qui clignotent avant Octave), puis Octave — ou, sans
 * musique, l'accueil d'avant, sans erreur. Toute autre adresse (un lien
 * profond) est servie telle quelle — et éteint le mode (`tentaclePageEndsMode`).
 */
export function OctaveHomeGate({ children }: { children: ReactElement }) {
  const on = useOctaveMode();
  const { pathname } = useLocation();
  const atHome = pathname === "/";
  // Hors ligne compris : le mode est celui de l'appareil (`useOctaveLaunchAvailability` : une panne n'est pas une absence).
  const wants = on && atHome;
  const landing = octaveLanding(wants, useOctaveLaunchAvailability(wants));
  // La première image de Tentacle : ce que le lancement en Octave retenait part.
  useEffect(() => {
    if (landing === "tentacle") releaseTentacle();
  }, [landing]);
  // À l'ARRIVÉE sur une page, jamais à un changement du mode : la page qui s'efface vers Octave
  // garde son adresse (`AnimatedRoutes`) et éteindrait le mode qu'Octave vient d'allumer.
  useEffect(() => {
    if (tentaclePageEndsMode(isOctaveMode(), atHome)) setOctaveMode(false);
  }, [pathname, atHome]);
  if (landing === "pending") return null;
  // La page gardée tant qu'Octave n'a pas été atteint dans ce chargement ; ensuite, son accueil.
  if (landing === "octave") return <Navigate to={octavePageReached() ? OCTAVE_BASE_PATH : launchPage} replace />;
  return children;
}
