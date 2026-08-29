/**
 * Attendre qu'un défilement ait monté de nouvelles cibles.
 *
 * C'est le point où une navigation à la télécommande rencontre la
 * virtualisation, et il ne se contourne pas : le fenêtrage des rangées ne
 * monte que les cartes proches de la zone visible, et vide entièrement une
 * rangée sortie de l'écran. Une carte non montée n'est pas atteignable — elle
 * n'existe pas dans le document.
 *
 * Le protocole est donc en trois temps : viser, provoquer le montage, viser à
 * nouveau. Cette dernière étape se joue ici.
 *
 * Le budget est borné, et c'est essentiel : quand le défilement n'apporte rien
 * — bas de page, rangée réellement vide —, un observateur non borné tournerait
 * indéfiniment sur un processeur qui n'en a pas les moyens.
 */

/**
 * Durée maximale d'attente d'un montage, en millisecondes.
 *
 * Taillée pour un déplacement : le fenêtrage d'une rangée monte ses cartes en
 * quelques images, et au-delà l'utilisateur a déjà réappuyé. L'entrée sur un
 * écran, elle, attend des DONNÉES et se donne un budget plus long — que
 * l'appelant fournit.
 */
const BUDGET_MS = 250;

/** Nombre d'images laissées au moteur de rendu avant la première tentative. */
const MIN_FRAMES = 2;

export type Attempt = () => boolean;

export interface ReviewOptions {
  /** Durée maximale d'attente. Par défaut, celle d'un déplacement. */
  budgetMs?: number;
  /** Appelé quand le budget s'épuise sans que la tentative ait réussi. C'est
   *  le seul endroit où l'on sait qu'on a renoncé, et donc le seul où poser un
   *  repli — un écran sans anneau est le pire des états. */
  onTimeout?: () => void;
}

/**
 * Rejoue `attempt` jusqu'à ce qu'elle réussisse ou que le budget s'épuise.
 *
 * Deux déclencheurs : les mutations du document — le montage des cartes — et
 * le rythme d'affichage, car un changement de disposition sans mutation (une
 * image qui arrive et modifie une hauteur) ne produit aucune mutation
 * observable sur les nœuds surveillés.
 */
export function reviewAfterMount(attempt: Attempt, options: ReviewOptions = {}): void {
  const budgetMs = options.budgetMs ?? BUDGET_MS;
  let done = false;
  let frames = 0;

  const stop = (succeeded: boolean) => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timer);
    if (!succeeded) options.onTimeout?.();
  };

  const tick = () => {
    if (done) return;
    if (frames < MIN_FRAMES) {
      frames++;
      requestAnimationFrame(tick);
      return;
    }
    if (attempt()) stop(true);
  };

  const observer = new MutationObserver(() => {
    if (!done) requestAnimationFrame(tick);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Deux attributs, et deux seulement.
    //
    // Une cible d'entrée ne paraît pas toujours en même temps que son nœud :
    // les réglages posent `data-tv-focus-fallback` sur la section affichée un
    // instant après l'avoir montée, et `SettingsShell` écrit `aria-current` de
    // la même façon. Sans les observer, la révision dormait — plus aucune
    // mutation de structure ne venait la réveiller — et l'écran gardait le
    // focus que l'ordre de lecture lui avait donné, en l'occurrence une action
    // destructive.
    //
    // Un filtre, pas `attributes: true` : sur une dalle, se faire réveiller par
    // chaque changement de classe d'une grille de deux cents cartes coûterait
    // exactement ce que ce module cherche à économiser.
    attributeFilter: ["data-tv-focus-defaut", "aria-current"],
  });
  const timer = setTimeout(() => stop(false), budgetMs);

  requestAnimationFrame(tick);
}
