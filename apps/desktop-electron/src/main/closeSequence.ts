/**
 * Fermer la fenêtre doit emporter mpv — sinon la vidéo survit à l'application.
 *
 * # Ce qui se passait
 *
 * Rien n'arrêtait le lecteur à la fermeture. Sur Windows et sur macOS ça ne se
 * voit pas : la fenêtre de mpv y est un ENFANT de la nôtre, et le système la
 * détruit avec son parent. **Sur Linux, mpv possède sa propre fenêtre de premier
 * niveau** — elle reste donc à l'écran, et le son continue, jusqu'à ce que le
 * processus meure. Entre les deux, `will-quit` (`index.ts`) fait du travail
 * SYNCHRONE : décoller la colle KWin par gdbus, refermer la connexion X11, fermer
 * la base. D'où la seconde et demie d'image orpheline mesurée à l'usage.
 *
 * # L'ordre, et pourquoi c'est celui-là
 *
 * Deux fenêtres de premier niveau ne peuvent pas disparaître à la même image :
 * elles appartiennent à deux clients du compositeur. On choisit donc laquelle
 * part la première, et c'est la NÔTRE — `hide()` est immédiat, et pendant la
 * lecture notre fenêtre est transparente : la garder une image de plus, c'est
 * montrer l'habillage du lecteur posé sur le bureau. mpv suit dans la foulée,
 * en quelques dizaines de millisecondes.
 *
 * # Les trois garde-fous
 *
 * `preventDefault()` sur une fermeture est un pouvoir désagréable (voir
 * `quitGuard.ts`, qui porte le même avertissement) :
 *
 *  1. la garde de téléchargement passe DEVANT — si elle a déjà retenu la
 *     fermeture pour poser sa question, on ne fait rien ;
 *  2. un loquet, pour qu'un second Alt+F4 pendant le démontage laisse la fenêtre
 *     se fermer pour de bon ;
 *  3. un délai de garde : passé lui, on détruit la fenêtre même si mpv n'a pas
 *     rendu la main. Une application qui ne se ferme plus coûte bien plus cher
 *     qu'un lecteur mal démonté à la toute fin d'un processus qui meurt.
 */

/** Ce qu'on demande à la fenêtre, et rien de plus — pour que ça se teste. */
export interface ClosingWindow {
  on(event: "close", listener: (event: CloseEvent) => void): unknown;
  hide(): void;
  destroy(): void;
  isDestroyed(): boolean;
}

/** La part de l'évènement d'Electron dont dépend la séquence. */
export interface CloseEvent {
  preventDefault: () => void;
  /** Vrai quand la garde de sortie a déjà retenu la fermeture. */
  defaultPrevented: boolean;
}

/**
 * Au-delà, on cesse d'attendre mpv.
 *
 * Une seconde et demie : le double de ce que prend un démontage normal, et la
 * moitié du délai de garde de `mpvShutdown.ts` — celui-ci doit rendre la main
 * AVANT que l'autre n'abandonne, sans quoi les deux se superposeraient.
 */
export const CLOSE_DEADLINE_MS = 1_500;

export function installCloseSequence(
  window: ClosingWindow,
  playerRunning: () => boolean,
  stopPlayer: () => Promise<void>,
  deadlineMs: number = CLOSE_DEADLINE_MS,
): void {
  let closing = false;

  window.on("close", (event) => {
    // Deuxième fermeture pendant le démontage : on la laisse passer. La fenêtre
    // est déjà cachée, la détruire est justement ce qu'on veut.
    if (closing) return;
    // La garde de sortie a la parole en premier : sa boîte est ouverte, et
    // court-circuiter sa réponse emporterait un téléchargement sans un mot.
    if (event.defaultPrevented) return;

    let running = false;
    try {
      running = playerRunning();
    } catch {
      // Un lecteur qu'on n'arrive pas à interroger ne doit pas retenir la
      // fermeture : on repart sur le chemin d'avant.
      return;
    }
    if (!running) return;

    event.preventDefault();
    closing = true;

    // La fenêtre s'en va MAINTENANT — avant tout travail, pour que le clic sur
    // la croix ait l'effet qu'on en attend.
    window.hide();

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      if (!window.isDestroyed()) window.destroy();
    };
    const limit = setTimeout(finish, deadlineMs);

    // `then(finish, finish)` : un arrêt qui échoue ne doit pas laisser une
    // fenêtre cachée et une application vivante — c'est le pire des états.
    stopPlayer().then(finish, finish);
  });
}
