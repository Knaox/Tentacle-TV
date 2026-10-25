/**
 * Octave — le chargement du mode et la porte de l'accueil : quand le mode est
 * allumé (au lancement par le réglage « Au démarrage, ouvrir », ou en cours de
 * session par la bascule), `/` EST Octave — comme le mode hors ligne remplace
 * l'accueil par le catalogue local.
 */

import { lazy, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { OCTAVE_BASE_PATH, isOctaveMode, useOctaveMode } from "./octaveMode";
import { octaveLanding } from "./octaveStartup";
import { useOctaveAvailability } from "./useOctaveAvailability";

type OctaveModule = typeof import("../OctaveApp");
let octaveModule: Promise<OctaveModule> | null = null;

/** Le module du mode, chargé UNE fois ; un échec (réseau) se retente au geste suivant. */
export function loadOctaveApp(): Promise<OctaveModule> {
  if (!octaveModule) {
    octaveModule = import("../OctaveApp");
    octaveModule.catch(() => {
      octaveModule = null;
    });
  }
  return octaveModule;
}

/** Le mode entier, chargé à la demande : rien n'est téléchargé avant d'y entrer. */
export const LazyOctaveApp = lazy(loadOctaveApp);

// Lancement en Octave : le module part AVEC la vérification de la disponibilité,
// pas après — la première image peinte est celle d'Octave.
if (isOctaveMode()) void loadOctaveApp().catch(() => undefined);

/**
 * Enveloppe la mise en page de l'application. Sur l'accueil (`/`), mode
 * allumé : rien tant que la disponibilité n'est pas connue (jamais la barre ni
 * l'accueil vidéo qui clignotent avant Octave), puis Octave — ou, sans
 * musique, l'accueil d'avant, sans erreur. Toute autre adresse (un lien
 * profond) est servie telle quelle.
 */
export function OctaveHomeGate({ children, enabled }: { children: ReactElement; enabled: boolean }) {
  const on = useOctaveMode();
  const atHome = useLocation().pathname === "/";
  const wants = on && enabled && atHome;
  const landing = octaveLanding(wants, useOctaveAvailability(wants));
  if (landing === "pending") return null;
  if (landing === "octave") return <Navigate to={OCTAVE_BASE_PATH} replace />;
  return children;
}
