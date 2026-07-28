/**
 * Les deux blocages d'économie d'énergie, et rien d'autre.
 *
 * **L'écran**, pendant la lecture (`prevent-display-sleep`). Sous Windows, mpv
 * est embarqué en `--wid` : sa fenêtre est une fenêtre ENFANT de la nôtre. Le
 * `stop-screensaver` de mpv s'appuie sur les messages
 * `SC_SCREENSAVE`/`SC_MONITORPOWER`, que le système n'envoie qu'à la fenêtre de
 * premier plan — jamais à une enfant. On ne peut donc pas compter dessus, et
 * `powerSaveBlocker` d'Electron dit au système, explicitement, de garder l'écran
 * allumé.
 *
 * **La machine**, pendant un téléchargement (`prevent-app-suspension`). C'est
 * ce qui donne son sens à « les transferts continuent en arrière-plan » :
 * l'utilisateur s'éloigne, Windows endort le PC au bout de son délai
 * d'inactivité et le flux HTTP est coupé net. Ce blocage-là repousse la veille
 * SANS empêcher l'écran de s'éteindre — on n'allume pas un écran pour un
 * transfert.
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

/** Les deux seuls types qu'on demande à Electron. */
export type TypeBlocage = "prevent-display-sleep" | "prevent-app-suspension";

/** Ce qu'on demande à `powerSaveBlocker`, et rien de plus. */
export interface BloqueurVeille {
  start(type: TypeBlocage): number;
  stop(id: number): void;
  isStarted(id: number): boolean;
}

export interface Veille {
  /** Pose le blocage. Sans effet s'il est déjà posé. */
  empecher(): void;
  /** Rend le système à son comportement normal. Sans effet s'il n'y a rien à rendre. */
  rendre(): void;
}

/**
 * Le mécanisme, écrit une seule fois pour les deux blocages.
 *
 * Chaque appel produit un état INDÉPENDANT : l'anti-veille de l'écran et
 * l'anti-suspension des téléchargements cohabitent sans se marcher dessus.
 */
function creerBlocage(bloqueur: BloqueurVeille, type: TypeBlocage): Veille {
  let blocage: number | null = null;

  return {
    empecher(): void {
      // `isStarted` plutôt que la seule présence de l'identifiant : le système
      // peut avoir levé le blocage de son côté, et on se retrouverait alors à
      // croire l'écran protégé sans qu'il le soit.
      if (blocage !== null && bloqueur.isStarted(blocage)) return;
      blocage = bloqueur.start(type);
    },
    rendre(): void {
      if (blocage === null) return;
      if (bloqueur.isStarted(blocage)) bloqueur.stop(blocage);
      blocage = null;
    },
  };
}

/** Empêche l'écran de s'éteindre. Pour la lecture. */
export function creerVeilleEcran(bloqueur: BloqueurVeille): Veille {
  return creerBlocage(bloqueur, "prevent-display-sleep");
}

/** Empêche la mise en veille du PC. Pour les téléchargements. */
export function creerVeilleSysteme(bloqueur: BloqueurVeille): Veille {
  return creerBlocage(bloqueur, "prevent-app-suspension");
}
