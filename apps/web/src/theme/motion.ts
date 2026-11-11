import type { Variants, Transition } from "framer-motion";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
};

/**
 * Les courbes de la refonte (nov. 2026, docs/REFONTE-UI.md) — celles de `tokens.css`, pour framer.
 *
 * `easeOut` : tout ce qui ENTRE ou SORT, et la réponse à un geste — départ vif, l'interface
 * répond dès la première image. `easeInOut` : ce qui se DÉPLACE à l'écran. `easeDrawer` : les
 * feuilles et les modales (la courbe de tiroir d'iOS).
 *
 * Il n'y a PAS de courbe d'accélération (`ease-in`) : elle démarre lentement, donc retarde le
 * moment exact que l'utilisateur regarde. Une sortie est plus COURTE que l'entrée, pas plus
 * molle au départ.
 */
export const easeOut = [0.23, 1, 0.32, 1] as const;
export const easeInOut = [0.77, 0, 0.175, 1] as const;
export const easeDrawer = [0.32, 0.72, 0, 1] as const;

/** La pression d'un contrôle : 120 ms, dès l'appui (`whileTap` de framer part au pointeur enfoncé). */
export const pressTransition: Transition = { type: "tween", duration: 0.12, ease: easeOut };
/** Ressort « press » — gardé pour les gestes interruptibles (glisser, lâcher) ; un bouton prend `pressTransition`. */
export const springPress: Transition = { type: "spring", stiffness: 420, damping: 28, mass: 0.6 };
/** Ressort doux — éléments partagés (pastille de nav), sans rebond marqué. */
export const springSoft: Transition = { type: "spring", stiffness: 320, damping: 32 };

/**
 * Échelle de durées, en secondes — les valeurs de `tokens.css` (`--duration-*`).
 *
 * Par RÔLE, à préférer dans tout code nouveau : `press` (un bouton pressé), `hover` (survol,
 * couleur), `menuIn` / `menuOut` (menu, déroulant, infobulle), `card` (survol d'une carte),
 * `sheetIn` / `sheetOut` (feuille, modale), `page` (changement de page : un fondu, rien d'autre).
 * Rien d'interface ne dépasse 320 ms. Un geste déclenché au CLAVIER ne s'anime pas.
 *
 * Les paliers `fast` / `base` / `slow` restent pour le code existant.
 */
export const duration = {
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
  page: 0.14,
  pageOut: 0.12,
  press: 0.12,
  hover: 0.16,
  menuIn: 0.18,
  menuOut: 0.12,
  card: 0.22,
  sheetIn: 0.32,
  sheetOut: 0.2,
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

/**
 * L'arrivée de la fiche média SANS calque d'ouverture : ses images sont déjà
 * décodées (`useDetailArrival`), rien n'est à attendre — le texte part avec le
 * décor et l'affiche, en une seule entrée. Avec 0,14 s d'amorce, le surtitre,
 * le logo puis les boutons arrivaient en trois temps après les images (relevé
 * du lot 1017).
 */
export const textCascadeArrival: Variants = {
  show: { transition: { delayChildren: 0.02, staggerChildren: 0.03 } },
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

/**
 * Le changement de page : un FONDU seul — ni glissement, ni échelle.
 *
 * Entre deux routes, c'est la page QUITTÉE qui s'efface (`duration.pageOut`, 120 ms) par-dessus
 * la suivante, déjà complète (`routeTransition/RouteExit`) : la page d'arrivée n'a pas de fondu
 * à elle. `initial` / `animate` ne valent plus que pour une page rendue HORS des routes (une vue
 * d'Octave, un écran posé seul), qui entre en 140 ms.
 */
export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.page, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: duration.pageOut, ease: "easeOut" } },
} as const;

export const respectReducedMotion = <T extends Transition>(t: T): T | { duration: 0 } => {
  return prefersReducedMotion() ? { duration: 0 } : t;
};

export const noMotion = prefersReducedMotion;
