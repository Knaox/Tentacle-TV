import type { ReactNode } from "react";
import { cls } from "../../../pages/adminUtils";

export interface Choice<T extends string | number> {
  value: T;
  label: string;
}

interface ChoiceChipsProps<T extends string | number> {
  name: string;
  legend: string;
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Sous les pastilles : la saisie libre quand « Autre » est choisi, et son erreur. */
  children?: ReactNode;
}

// L'état coché se lit sur le bouton radio FRÈRE (`peer-checked`), pas par
// `:has()` : Chromium invalidait mal `:has(:checked)` quand un autre bouton du
// groupe prenait la main — la pastille restait allumée sur l'ancien choix
// jusqu'au rendu suivant. La puce choisie prend le fond doux et le trait de la
// teinte franche (la tuile de choix du socle, en pastille).
const CHIP =
  "lg-glass-btn num inline-flex h-9 min-w-[2.75rem] select-none items-center justify-center rounded-full border border-transparent px-3.5 text-[13px] font-semibold transition-colors duration-hover " +
  "bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary " +
  "peer-checked:bg-accent-soft peer-checked:text-content-primary peer-checked:shadow-[inset_0_0_0_1.5px_var(--accent)] " +
  "peer-focus-visible:ring-2 peer-focus-visible:ring-line-focus";

/**
 * Un choix parmi quelques préréglages, en pastilles. De vrais boutons radio
 * sous le capot, masqués : les flèches du clavier passent d'une pastille à
 * l'autre et un lecteur d'écran annonce le groupe, sans rien réimplémenter.
 */
export function ChoiceChips<T extends string | number>({
  name, legend, choices, value, onChange, children,
}: ChoiceChipsProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className={cls.lbl}>{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label key={String(choice.value)} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={choice.value === value}
              onChange={() => onChange(choice.value)}
            />
            <span className={CHIP}>{choice.label}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
