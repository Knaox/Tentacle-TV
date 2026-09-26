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

// Opacités en `rgba(var(--brand-rgb), …)` : Tailwind 3 ne sait pas en poser une
// sur `[var(--brand)]/NN`, il supprime la déclaration sans rien dire.
const CHIP =
  "inline-flex h-9 min-w-[2.75rem] cursor-pointer select-none items-center justify-center rounded-full border px-3.5 text-xs font-semibold tabular-nums transition-colors " +
  "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary " +
  "has-[:checked]:border-[rgba(var(--brand-rgb),0.45)] has-[:checked]:bg-[var(--brand-soft)] has-[:checked]:text-content-primary " +
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[rgba(var(--brand-rgb),0.4)]";

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
          <label key={String(choice.value)} className={CHIP}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={choice.value === value}
              onChange={() => onChange(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
