/**
 * Un choix parmi deux ou trois, posé à plat.
 *
 * Remplace les `<select>` des réglages de lecture. Trois raisons, dans
 * l'ordre : les options sont VISIBLES sans ouvrir quoi que ce soit — c'est
 * tout l'enjeu, un réglage qu'on ne voit pas est un réglage qu'on ne
 * comprend pas ; il y a un clic au lieu de deux ; et la cible atteint 44 px,
 * ce qu'un menu déroulant de 32 px n'offrait pas.
 *
 * # Pourquoi une GRILLE et non une rangée flex
 *
 * En flex, un élément ne rétrécit pas sous la largeur de son contenu
 * (`min-width: auto`). Trois libellés français dans un cadre de 384 px en
 * sortaient donc par la droite, et le fond de la sélection se peignait
 * par-dessus la bordure arrondie du conteneur — le défaut signalé sur
 * « Ne rien faire ». Une grille partage la largeur SANS consulter le contenu :
 * le débordement n'est plus possible. `min-w-0` sur chaque option lève la même
 * contrainte à l'intérieur de sa colonne, et un libellé trop long se replie
 * sur deux lignes au lieu de sortir.
 *
 * # Pourquoi il ne s'étale plus, et pourquoi il a maigri
 *
 * Il occupait toute la carte en colonnes ÉGALES, à 44 px de haut : un réglage
 * de trois mots y prenait la place d'un bouton d'action, et l'écran de
 * réglages en aligne une dizaine. Deux corrections, sans toucher à la couleur.
 *
 * 1. Le groupe se dimensionne sur son contenu (`w-fit`, colonnes `auto`) et
 *    n'accepte un plafond que de son appelant. La protection ci-dessus tient
 *    toujours : `max-w-full` et `minmax(0, auto)` laissent les colonnes
 *    rétrécir, et le repli sur deux lignes reste le pire cas.
 * 2. La hauteur passe à 34 px À LA SOURIS. Le 44 px d'origine vient des règles
 *    natives iOS et Android ; sur le web, WCAG 2.2 AA demande 24 px CSS. Au
 *    DOIGT, `controls.css` le remonte à 44 px sous `@media (pointer: coarse)` :
 *    la parité tactile est gardée là où elle se mesure.
 */

interface SegmentedChoiceProps<T extends string> {
  /** Étiquette accessible du groupe (le titre du réglage). */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Tailwind ne voit pas `grid-cols-${n}` : les classes doivent être écrites.
 * `minmax(0,auto)` plutôt que `1fr` : les colonnes se dimensionnent sur les
 * libellés au lieu de partager la largeur en parts égales, tout en gardant le
 * droit de rétrécir quand l'appelant pose un plafond.
 */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-[minmax(0,auto)]",
  2: "grid-cols-[repeat(2,minmax(0,auto))]",
  3: "grid-cols-[repeat(3,minmax(0,auto))]",
  4: "grid-cols-[repeat(4,minmax(0,auto))]",
};

export function SegmentedChoice<T extends string>({
  label, value, options, onChange, className = "",
}: SegmentedChoiceProps<T>) {
  const columns = COLUMNS[options.length] ?? COLUMNS[3];

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-grid w-fit max-w-full ${columns} gap-0.5 overflow-hidden rounded-[10px] border border-line-subtle bg-tentacle-surface p-0.5 ${className}`}
    >
      {options.map((option) => {
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            /* La peau — dégradé de marque, survol, état pressé, lueur — vit
               dans `theme/controls.css` : les trois contrôles de réglage la
               partagent, et l'état se lit sur `aria-checked`, qui est déjà là
               pour les lecteurs d'écran. */
            className="ctl-segment flex min-w-0 items-center justify-center text-center leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
