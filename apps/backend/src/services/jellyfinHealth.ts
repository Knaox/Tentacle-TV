import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { JellyfinHealthMachine, type HealthSnapshot } from "./jellyfinHealthMachine";
import { probeJellyfinHealth } from "./jellyfinHealthProbe";

/**
 * L'état de Jellyfin pour tout le processus — la machine de
 * `jellyfinHealthMachine.ts`, branchée sur la vraie horloge et la vraie sonde.
 *
 * Qui l'alimente : la socket du serveur (`jellyfinWs.ts` : annonces de
 * Jellyfin, fermeture, réouverture). Qui l'écoute : le canal de session
 * (prévenir les lecteurs, relancer les connexions des appareils et les
 * reports au retour), la socket elle-même (rouvrir sans attendre son
 * backoff), `/api/health` et le tableau de bord.
 */

const machine = new JellyfinHealthMachine({
  probe: () => probeJellyfinHealth(getJellyfinUrl(), getJellyfinApiKey()),
  clock: {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
});

machine.subscribe((next, previous) => {
  const lasted = Math.round((next.since - previous.since) / 100) / 10;
  console.log(`[jellyfin-health] ${previous.state} → ${next.state} (après ${lasted} s)`);
});

export type { HealthSnapshot };

export function jellyfinHealth(): HealthSnapshot {
  return machine.current();
}

/** Écoute les changements d'état ; rend la fonction de désabonnement. */
export function onJellyfinHealth(listener: (next: HealthSnapshot, previous: HealthSnapshot) => void): () => void {
  return machine.subscribe(listener);
}

export function jellyfinAnnounced(kind: "restarting" | "shutting-down"): void {
  machine.announce(kind);
}

export function jellyfinSocketLost(): void {
  machine.socketLost();
}

export function jellyfinSocketOpened(): void {
  machine.socketOpened();
}
