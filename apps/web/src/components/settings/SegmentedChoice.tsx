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
 * « Ne rien faire ». Une grille à colonnes égales partage la largeur SANS
 * consulter le contenu : le débordement n'est plus possible. `min-w-0` sur
 * chaque option lève la même contrainte à l'intérieur de sa colonne, et un
 * libellé trop long se replie sur deux lignes au lieu de sortir.
 */

interface SegmentedChoiceProps<T extends string> {
  /** Étiquette accessible du groupe (le titre du réglage). */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** Tailwind ne voit pas `grid-cols-${n}` : les classes doivent être écrites. */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function SegmentedChoice<T extends string>({
  label, value, options, onChange, className = "",
}: SegmentedChoiceProps<T>) {
  const columns = COLUMNS[options.length] ?? "grid-cols-3";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid ${columns} gap-1 overflow-hidden rounded-lg border border-line-subtle bg-tentacle-surface p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-md px-2 text-center text-sm leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              active
                // La sélection porte la teinte de marque : `bg-fill-medium` ne
                // se distinguait pas du cadre, qui est déjà un remplissage.
                ? "bg-tentacle-accent font-semibold text-cta-brand-fg hover:bg-tentacle-accent-dark"
                : "font-medium text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
