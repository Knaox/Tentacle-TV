import type { Variants, Transition } from "framer-motion";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
};

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

/** Ressort « press » — réponse vive des contrôles (hover/tap), ~180 ms perçus. */
export const springPress: Transition = { type: "spring", stiffness: 420, damping: 28, mass: 0.6 };
/** Ressort doux — éléments partagés (pastille de nav), sans rebond marqué. */
export const springSoft: Transition = { type: "spring", stiffness: 320, damping: 32 };

/**
 * Échelle de durées, en secondes.
 *
 * Bornes tenues : 150–300 ms pour une micro-interaction, 400 ms au maximum pour
 * une transition composée, jamais au-delà de 500 ms — passé ce seuil le
 * mouvement n'accompagne plus le geste, il le fait attendre. `page` est descendu
 * de 600 à 400 ms pour cette raison.
 */
export const duration = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  page: 0.4,
} as const;

/**
 * Sortie plus courte que l'entrée (≈65 %) : une surface qui s'efface n'a plus
 * rien à raconter, la traîner donne l'impression que l'interface met du temps à
 * répondre.
 */
export const exitDuration = (enter: number): number => enter * 0.65;

/**
 * Cadence d'une animation d'AMBIANCE — combien de fois par seconde sa valeur
 * change réellement.
 *
 * Pourquoi c'est nécessaire : une animation composée est réévaluée à chaque
 * rafraîchissement de l'écran, quel qu'il soit — soixante fois par seconde sur
 * un écran ordinaire, cent vingt sur un ProMotion, jusqu'à deux cent quarante
 * sur un écran de jeu. Pour un mouvement de quelques millisecondes, c'est ce
 * qu'il faut. Pour un travelling de six pour cent étalé sur huit secondes, c'est
 * du travail jeté : à cent vingt images par seconde, l'échelle avance d'un
 * DIXIÈME de pixel entre deux images, sur une surface qui fait tout l'écran.
 *
 * Le calcul qui autorise ce réglage, sur une bannière de ~1700 px de haut :
 *
 *   cadence   progression par image
 *   120 Hz    0,10 px
 *    30 Hz    0,42 px
 *
 * Les deux sont sous le pixel. Un mouvement qui avance de moins d'un pixel par
 * image est lisse par construction — la cadence n'y change rien de visible. À
 * l'inverse, une transition de survol de 240 ms parcourt une soixantaine de
 * pixels : celle-là doit rester à pleine cadence, et n'a rien à faire ici.
 *
 * ⚠️ RÈGLE D'EMPLOI, à ne pas élargir : réservé aux animations de plus de six
 * secondes dont la progression reste sous un pixel par image à la cadence
 * choisie. Jamais sur ce qui répond à un geste — survol, lift, fondu,
 * défilement, ressort. En cas de doute, ne pas s'en servir : le gain se compte
 * en milliwatts, une saccade se voit.
 *
 * Le temps est quantifié AVANT la courbe, jamais la valeur après : `ease` reste
 * donc intacte, quelle qu'elle soit. Sans `ease`, la progression est linéaire —
 * et le résultat est alors rigoureusement identique aux mêmes instants, seule la
 * fréquence des mises à jour change.
 *
 * @param hz      Mises à jour par seconde visées.
 * @param seconds Durée de l'animation, pour convertir en nombre de paliers.
 * @param ease    Courbe éventuelle, appliquée après quantification.
 */
export const cadence =
  (hz: number, seconds: number, ease?: (t: number) => number) =>
  (t: number): number => {
    const steps = Math.max(1, Math.round(hz * seconds));
    // `round` et non `floor` : le palier le plus proche, donc pas de retard
    // systématique d'une demi-période, et t = 1 tombe exactement sur 1 — la
    // valeur finale est bien atteinte.
    const quantized = Math.round(t * steps) / steps;
    return ease ? ease(quantized) : quantized;
  };

/**
 * Cadence des mouvements d'ambiance de l'application. Trente images par seconde
 * — la limite basse à laquelle un travelling lent reste indistinguable du plein
 * régime, tout en divisant par deux à huit le nombre de recompositions selon la
 * fréquence de l'écran.
 */
export const AMBIENT_HZ = 30;

/**
 * Révélation de texte. `y: 10` et non 20 : au-delà d'une dizaine de pixels le
 * texte ne « se pose » plus, il glisse — et sur une cascade de cinq lignes les
 * glissements se voient les uns après les autres. C'est aussi une ligne de base
 * commune à la bannière, à la fiche média et à l'en-tête de bibliothèque, qui
 * avaient chacune leur amplitude.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOut } },
};

/**
 * Cascade de texte : décalage de 40 ms par ligne, dans la fourchette 30–50 ms
 * qui laisse percevoir l'ordre sans donner l'impression d'attendre la dernière.
 *
 * ⚠️ Ces objets sont des CONSTANTES de module, et ce n'est pas un détail de
 * style. Framer ré-résout tout l'arbre de variantes quand l'identité de la prop
 * `variants` change — un littéral écrit dans le JSX, ou un appel de fabrique
 * dans le corps du composant, en produit un neuf à CHAQUE rendu et rejoue donc
 * la cascade entière. Tant que la page ne se rendait qu'une fois, cela ne se
 * voyait pas ; dès qu'un rendu supplémentaire survient (une mesure qui remonte,
 * une requête qui arrive), tout le texte se remet à clignoter.
 *
 * Si un appelant a besoin d'un autre délai, qu'il crée SA constante de module —
 * pas un objet en ligne.
 */
export const textCascade: Variants = {
  show: { transition: { delayChildren: 0.04, staggerChildren: 0.04 } },
};

/** Amorce plus tardive : le texte attend qu'une transition d'ouverture se pose. */
export const textCascadeDelayed: Variants = {
  show: { transition: { delayChildren: 0.14, staggerChildren: 0.04 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: easeOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: easeOut } },
};

export const stagger = (delayChildren = 0.1, staggerChildren = 0.06): Variants => ({
  show: { transition: { delayChildren, staggerChildren } },
});

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.base, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: exitDuration(duration.base), ease: easeOut } },
};

export const respectReducedMotion = <T extends Transition>(t: T): T | { duration: 0 } => {
  return prefersReducedMotion() ? { duration: 0 } : t;
};

export const noMotion = prefersReducedMotion;
