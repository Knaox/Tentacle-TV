/**
 * Le curseur fantôme.
 *
 * C'est le modèle d'`apps/tv` transposé, et son point central mérite d'être
 * écrit noir sur blanc : **aucun déplacement n'est appliqué avant
 * confirmation**. Les flèches font avancer un curseur, la vidéo reste où elle
 * est — en pause — et ce n'est qu'à l'appui sur OK qu'un seul déplacement est
 * demandé. Traduire chaque flèche en un saut donnerait, sur un flux transcodé,
 * une rafale de reconstructions d'URL pour arriver quelque part qu'on n'a même
 * pas visé.
 *
 * Trois portes de sortie, et elles ne font pas la même chose : OK confirme,
 * Retour annule, et l'inactivité annule aussi. La troisième est un filet — on
 * repose la télécommande en cours de route, et on ne veut pas retrouver le film
 * déplacé de vingt minutes en revenant.
 *
 * L'accélération est réservée au MAINTIEN. Un appui simple avance d'un pas
 * fixe : c'est la seule façon de viser une position précise, et la répétition
 * automatique ne doit pas transformer une pression appuyée en bond de deux
 * minutes.
 *
 * Module pur — ni React, ni DOM, horloge injectable. C'est ce qui le rend
 * testable, et ce qui permet de vérifier la seule chose qui compte vraiment :
 * qu'`annuler()` n'appelle jamais `surSeek`.
 */

/** Le pas d'un appui simple. Dix secondes : un plan, pas une scène. */
export const PAS_SCRUB_S = 10;

/** Les paliers du maintien. Au-delà de huit, on ne vise plus rien. */
export const PALIERS = [1, 2, 4, 8] as const;

/** Sans nouvelle touche, on annule. Sept secondes : on a reposé la télécommande. */
export const INACTIVITE_ANNULE_MS = 7000;

export interface OptionsMachineScrub {
  lirePosition: () => number;
  lireDuree: () => number;
  surEntree: (position: number, palier: number) => void;
  surChangement: (position: number, palier: number) => void;
  surPause: (pause: boolean) => void;
  surSeek: (secondes: number) => void;
  surSortie: () => void;
}

export interface MachineScrub {
  /**
   * Entrer en déplacement SANS bouger : le curseur fantôme se pose là où l'on
   * en est, et attend.
   *
   * C'est le geste du bouton dédié de la rangée, et celui d'`apps/tv`
   * (`enterScrub` → `startScrubbing`). Une flèche, elle, entre en avançant —
   * c'est `pas`, qui amorce au passage. Les deux amorcent la même machine ; ce
   * qui les distingue est qu'on a désigné une direction, ou non.
   */
  entrer: () => void;
  pas: (sens: 1 | -1, palier: number) => void;
  confirmer: () => void;
  annuler: () => void;
  estActif: () => boolean;
  detruire: () => void;
}

export function creerMachineScrub(options: OptionsMachineScrub): MachineScrub {
  let actif = false;
  let position = 0;
  let inactivite: ReturnType<typeof setTimeout> | null = null;

  function armerInactivite(): void {
    if (inactivite !== null) clearTimeout(inactivite);
    inactivite = setTimeout(() => {
      inactivite = null;
      annuler();
    }, INACTIVITE_ANNULE_MS);
  }

  function desarmer(): void {
    if (inactivite === null) return;
    clearTimeout(inactivite);
    inactivite = null;
  }

  function borner(valeur: number): number {
    const duree = options.lireDuree();
    if (!(duree > 0)) return Math.max(0, valeur);
    return Math.min(Math.max(0, valeur), duree);
  }

  /** L'entrée en déplacement, commune au bouton et à la première flèche. */
  function amorcer(palier: number): void {
    actif = true;
    position = borner(options.lirePosition());
    options.surPause(true);
    options.surEntree(position, palier);
  }

  function entrer(): void {
    if (actif) return;
    amorcer(PALIERS[0]);
    // La veille d'inactivité vaut ici comme ailleurs : entrer en déplacement et
    // reposer la télécommande ne doit pas laisser la vidéo en pause.
    armerInactivite();
  }

  function pas(sens: 1 | -1, palier: number): void {
    const multiplicateur = PALIERS.indexOf(palier as (typeof PALIERS)[number]) >= 0 ? palier : 1;

    if (!actif) amorcer(multiplicateur);

    position = borner(position + sens * PAS_SCRUB_S * multiplicateur);
    options.surChangement(position, multiplicateur);
    armerInactivite();
  }

  function confirmer(): void {
    if (!actif) return;
    const cible = position;
    actif = false;
    desarmer();
    options.surSortie();
    // Le déplacement d'abord, la reprise ensuite : reprendre avant de déplacer
    // ferait jouer une seconde de l'ancienne position.
    options.surSeek(cible);
    options.surPause(false);
  }

  function annuler(): void {
    if (!actif) return;
    actif = false;
    desarmer();
    options.surSortie();
    // Aucun `surSeek` : c'est toute la différence avec une confirmation, et
    // c'est ce qui rend l'abandon sur inactivité inoffensif.
    options.surPause(false);
  }

  return {
    entrer,
    pas,
    confirmer,
    annuler,
    estActif: () => actif,
    detruire: () => {
      desarmer();
      actif = false;
    },
  };
}
