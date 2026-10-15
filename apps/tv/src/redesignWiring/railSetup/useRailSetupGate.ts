import { useCallback, useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { useLibraries } from "@tentacle-tv/api-client";
import {
  RAIL_SETUP_MAX_WAIT_MS,
  settleRailSetup,
  type RailLayout,
  type RailSetupLatch,
  type RailSetupStatus,
} from "@tentacle-tv/tv-core";
import { railPinningStore } from "../../components/nav/railPinning";
import { useServerReachability } from "../../hooks/serverReachability";

/**
 * La porte de la PRÉCONFIGURATION du rail, pour l'identité active (compte
 * jumelé ou profil ouvert) — Apple TV et Android TV. La règle est dans
 * tv-core (`decideRailSetup`, `settleRailSetup`) ; on lui donne ce que la TV
 * sait : la préconfiguration faite (magasin par profil), les bibliothèques du
 * compte (`useLibraries` : les vues Jellyfin du compte ACTIF, donc déjà
 * filtrées par ses droits), la joignabilité du serveur.
 *
 * `wait` : on ne sait pas encore — l'accueil attend, borné par
 * `RAIL_SETUP_MAX_WAIT_MS`. La décision tranchée est TENUE pour l'identité le
 * temps de la session de l'app (en mémoire, partagée par tous les écrans) :
 * jamais une page qui surgit par-dessus un accueil déjà affiché.
 */

export interface RailSetupGate {
  status: RailSetupStatus;
  /** L'identité dont on parle ; null sans session. */
  identity: string | null;
  /** Sa disposition actuelle (la sienne, sinon l'héritée de l'appareil) : de quoi pré-remplir la page. */
  layout: RailLayout;
  /** Enregistre la disposition choisie et marque la préconfiguration faite. */
  complete: (layout: RailLayout) => void;
  /** « Passer » : marquée faite, la disposition actuelle gardée. */
  skip: () => void;
}

/** La décision tenue, et depuis quand on attend — en mémoire, pour toute l'app. */
let latch: RailSetupLatch | null = null;
let waitingSince: { identity: string | null; at: number } | null = null;

export function useRailSetupGate(): RailSetupGate {
  const active = useSyncExternalStore(railPinningStore.subscribe, railPinningStore.readSnapshot);
  const { data: libraries, isError } = useLibraries();
  const { reachable } = useServerReachability();
  const [tick, wake] = useReducer((count: number) => count + 1, 0);

  const { identity, setupDone } = active;
  const libraryCount = libraries ? libraries.length : isError ? "failed" : null;
  const now = Date.now();
  if (waitingSince?.identity !== identity) waitingSince = { identity, at: now };
  latch = settleRailSetup(latch, {
    identity,
    setupDone,
    libraries: libraryCount,
    online: reachable,
    waitedMs: now - waitingSince.at,
  });
  const status = latch.status;

  // L'attente a une borne : un réveil à son terme, si rien d'autre n'a tranché avant
  // (`tick` : réveillé un rien trop tôt, on se rendort pour le reste).
  useEffect(() => {
    if (status !== "wait" || !waitingSince) return undefined;
    const timer = setTimeout(wake, Math.max(0, waitingSince.at + RAIL_SETUP_MAX_WAIT_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [status, identity, tick]);

  const complete = useCallback(
    (layout: RailLayout) => {
      if (identity) railPinningStore.completeSetup(identity, layout);
    },
    [identity],
  );
  const skip = useCallback(() => {
    if (identity) railPinningStore.skipSetup(identity);
  }, [identity]);

  const layout = useMemo<RailLayout>(() => ({ masquees: active.masquees, order: active.order }), [active.masquees, active.order]);

  return useMemo(() => ({ status, identity, layout, complete, skip }), [status, identity, layout, complete, skip]);
}

/** Pour les tests : oublie la décision tenue. */
export function resetRailSetupGateForTests(): void {
  latch = null;
  waitingSince = null;
}
