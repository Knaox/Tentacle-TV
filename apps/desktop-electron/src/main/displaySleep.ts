/**
 * Anti-veille de l'écran pendant la lecture.
 *
 * # Pourquoi ce n'est pas mpv qui s'en charge
 *
 * Sous Windows, mpv est embarqué en `--wid` : sa fenêtre est une fenêtre ENFANT
 * de la nôtre. Le `stop-screensaver` de mpv s'appuie sur les messages
 * `SC_SCREENSAVE`/`SC_MONITORPOWER`, que le système n'envoie qu'à la fenêtre de
 * premier plan — jamais à une enfant. On ne peut donc pas compter dessus, et
 * `powerSaveBlocker` d'Electron dit au système, explicitement, de garder l'écran
 * allumé.
 *
 * # Deux exigences, et rien d'autre
 *
 * **Idempotence.** Le lecteur est démonté et remonté à chaque épisode
 * (`key={itemId}`) : `empecher()` est appelé plusieurs fois par série. Empiler
 * les blocages en laisserait autant d'orphelins.
 *
 * **Libération.** Un blocage actif tient jusqu'à la fin du processus : sans
 * `rendre()` à l'extinction, l'écran de l'utilisateur ne s'éteindrait plus de
 * la session, longtemps après la fermeture de l'application. Même devoir que
 * les touches média (`ipc/mediaKeys.ts`).
 *
 * Electron entre par la porte — c'est ce qui rend le tout vérifiable sans
 * lancer d'application.
 */

/** Ce qu'on demande à `powerSaveBlocker`, et rien de plus. */
export interface BloqueurVeille {
  start(type: "prevent-display-sleep"): number;
  stop(id: number): void;
  isStarted(id: number): boolean;
}

export interface VeilleEcran {
  /** Empêche l'écran de s'éteindre. Sans effet si c'est déjà le cas. */
  empecher(): void;
  /** Rend l'écran à sa veille normale. Sans effet s'il n'y a rien à rendre. */
  rendre(): void;
}

export function creerVeilleEcran(bloqueur: BloqueurVeille): VeilleEcran {
  let blocage: number | null = null;

  return {
    empecher(): void {
      // `isStarted` plutôt que la seule présence de l'identifiant : le système
      // peut avoir levé le blocage de son côté, et on se retrouverait alors à
      // croire l'écran protégé sans qu'il le soit.
      if (blocage !== null && bloqueur.isStarted(blocage)) return;
      blocage = bloqueur.start("prevent-display-sleep");
    },
    rendre(): void {
      if (blocage === null) return;
      if (bloqueur.isStarted(blocage)) bloqueur.stop(blocage);
      blocage = null;
    },
  };
}
