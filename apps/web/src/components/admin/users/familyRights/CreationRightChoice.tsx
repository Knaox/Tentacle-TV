import { memo, useRef, type KeyboardEvent } from "react";
import { FAMILY_CREATION_RIGHT_VALUES, type FamilyCreationRightValue } from "@tentacle-tv/shared";

interface CreationRightChoiceProps {
  /** L'identifiant du libellé de la ligne (le groupe s'y rattache). */
  labelledBy: string;
  value: FamilyCreationRightValue;
  /** Le libellé de chaque choix (« Par défaut (non) », « Permis », « Refusé »). */
  labels: Record<FamilyCreationRightValue, string>;
  disabled?: boolean;
  onChange: (value: FamilyCreationRightValue) => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/**
 * Trois choix d'un droit de création — Par défaut, Permis, Refusé —, en groupe
 * de boutons radio : un clic choisit, les flèches passent d'un choix à l'autre
 * (le focus suit), un seul choix tabulable (le choisi). L'état affiché est
 * celui que le serveur a rendu.
 */
export const CreationRightChoice = memo(function CreationRightChoice({ labelledBy, value, labels, disabled, onChange }: CreationRightChoiceProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || disabled) return;
    event.preventDefault();
    const count = FAMILY_CREATION_RIGHT_VALUES.length;
    const next = (FAMILY_CREATION_RIGHT_VALUES.indexOf(value) + step + count) % count;
    refs.current[next]?.focus();
    onChange(FAMILY_CREATION_RIGHT_VALUES[next]);
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className="inline-flex rounded-lg border border-line-subtle bg-fill-soft p-0.5">
      {FAMILY_CREATION_RIGHT_VALUES.map((choice, index) => {
        const checked = choice === value;
        return (
          <button
            key={choice}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => !checked && onChange(choice)}
            className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${
              checked ? "bg-[rgba(var(--brand-rgb),0.18)] text-content-primary" : "text-content-tertiary hover:text-content-primary"
            }`}
          >
            {labels[choice]}
          </button>
        );
      })}
    </div>
  );
});
