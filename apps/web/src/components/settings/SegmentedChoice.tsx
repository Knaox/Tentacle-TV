/**
 * Un choix parmi deux ou trois, posé à plat.
 *
 * Remplace les `<select>` des réglages de lecture. Trois raisons, dans
 * l'ordre : les options sont VISIBLES sans ouvrir quoi que ce soit — c'est
 * tout l'enjeu, un réglage qu'on ne voit pas est un réglage qu'on ne
 * comprend pas ; il y a un clic au lieu de deux ; et la cible atteint 44 px,
 * ce qu'un menu déroulant de 32 px n'offrait pas.
 *
 * Le curseur actif est un calque en fondu sous les libellés, pas une couleur
 * de fond animée : seuls `transform` et `opacity` composent sans repeindre.
 */

interface SegmentedChoiceProps<T extends string> {
  /** Étiquette accessible du groupe (le titre du réglage). */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedChoice<T extends string>({
  label, value, options, onChange, className = "",
}: SegmentedChoiceProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-lg border border-line-subtle bg-tentacle-surface p-1 ${className}`}
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
            className={`min-h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm transition-colors duration-150 ${
              active
                ? "bg-fill-medium font-semibold text-content-primary"
                : "font-medium text-content-tertiary hover:text-content-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
