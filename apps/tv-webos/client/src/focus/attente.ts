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

/** Durée maximale d'attente d'un montage, en millisecondes. */
const BUDGET_MS = 250;

/** Nombre d'images laissées au moteur de rendu avant la première tentative. */
const IMAGES_MINIMALES = 2;

export type Tentative = () => boolean;

/**
 * Rejoue `tentative` jusqu'à ce qu'elle réussisse ou que le budget s'épuise.
 *
 * Deux déclencheurs : les mutations du document — le montage des cartes — et
 * le rythme d'affichage, car un changement de disposition sans mutation (une
 * image qui arrive et modifie une hauteur) ne produit aucune mutation
 * observable sur les nœuds surveillés.
 */
export function reviserApresMontage(tentative: Tentative): void {
  let termine = false;
  let images = 0;

  const arreter = () => {
    if (termine) return;
    termine = true;
    observateur.disconnect();
    clearTimeout(minuteur);
  };

  const essayer = () => {
    if (termine) return;
    if (images < IMAGES_MINIMALES) {
      images++;
      requestAnimationFrame(essayer);
      return;
    }
    if (tentative()) arreter();
  };

  const observateur = new MutationObserver(() => {
    if (!termine) requestAnimationFrame(essayer);
  });

  observateur.observe(document.body, { childList: true, subtree: true });
  const minuteur = setTimeout(arreter, BUDGET_MS);

  requestAnimationFrame(essayer);
}
