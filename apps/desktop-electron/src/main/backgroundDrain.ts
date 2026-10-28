/**
 * « Continuer en arrière-plan » (bureau) : la fenêtre fermée pendant un transfert ne le coupe plus.
 *
 * Le moteur vit dans le processus principal (`downloadsRuntime.ts`) : rien n'exige la fenêtre pour finir un
 * film ou une playlist d'Octave. Fermer la fenêtre (croix, Alt+F4, bouton rouge) laisse donc le PROCESSUS
 * vivant, sans fenêtre, jusqu'à ce que la file soit vide — puis l'application se ferme d'elle-même. Quitter
 * (Cmd+Q, menu « Quitter ») reste quitter : la garde de sortie pose sa question (`quitGuard.ts`).
 *
 * Trois sorties, toutes ici et testées (`backgroundDrain.test.ts`) :
 * - la file est vide → quitter ;
 * - plus rien ne bouge depuis `DRAIN_IDLE_GIVE_UP_MS` (réseau coupé, serveur muet) → quitter : les
 *   transferts reprendront au prochain lancement, là où ils en sont ;
 * - on rouvre l'application (Dock, second lancement) → la RELANCER. Jamais une fenêtre refabriquée dans le
 *   même processus : c'est le défaut du « second lancement » (état vidéo d'une session morte, `index.ts`).
 *
 * La lecture (musique comprise) s'arrête dès la fermeture : seule la file continue.
 */

/** Ce que le processus fait pendant qu'il finit, injecté pour le test. */
export interface DrainDeps {
  /** Transferts en cours ou en file (`transfersInFlight`). */
  pending: () => number;
  /** Au moins un transfert tourne en ce moment (`onBusy` du moteur). */
  busy: () => boolean;
  quit: () => void;
  relaunch: () => void;
  /** Coupe la lecture : la fenêtre partie, plus rien ne doit sonner. */
  stopPlayback: () => void;
  /** Dit, une fois, que l'application finit ses transferts (notification du système). */
  announce: (pending: number) => void;
  now: () => number;
  every: (ms: number, tick: () => void) => { stop: () => void };
}

export const DRAIN_TICK_MS = 5_000;
export const DRAIN_IDLE_GIVE_UP_MS = 10 * 60_000;

export interface BackgroundDrain {
  /** La fenêtre se ferme, des transferts restent : le processus continue sans elle. */
  begin: () => void;
  active: () => boolean;
  /** Rouvrir pendant la fin des transferts : relance. Rend `false` hors de cette phase. */
  reopen: () => boolean;
  /** Un tour de vérification (le minuteur l'appelle ; exposé pour le test). */
  check: () => void;
}

export function createBackgroundDrain(deps: DrainDeps): BackgroundDrain {
  let active = false;
  let idleSince: number | null = null;
  let timer: { stop: () => void } | null = null;

  const end = (then: () => void): void => {
    active = false;
    timer?.stop();
    timer = null;
    then();
  };

  const check = (): void => {
    if (!active) return;
    let left = 0;
    try {
      left = deps.pending();
    } catch {
      // Une base qui ne répond plus ne retient pas le processus.
    }
    if (left <= 0) return end(deps.quit);
    if (deps.busy()) {
      idleSince = null;
      return;
    }
    idleSince ??= deps.now();
    if (deps.now() - idleSince >= DRAIN_IDLE_GIVE_UP_MS) end(deps.quit);
  };

  return {
    begin: () => {
      if (active) return;
      active = true;
      idleSince = null;
      deps.stopPlayback();
      deps.announce(deps.pending());
      timer = deps.every(DRAIN_TICK_MS, check);
    },
    active: () => active,
    reopen: () => {
      if (!active) return false;
      end(deps.relaunch);
      return true;
    },
    check,
  };
}
