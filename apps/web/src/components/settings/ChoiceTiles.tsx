import type { ReactNode } from "react";

export interface ChoiceTile<T extends string> {
  id: T;
  label: string;
  /** La phrase qui dit ce que ce choix fait. */
  hint?: string;
  icon?: ReactNode;
  /** Ce que ce choix donne à l'écran, sous son nom (un aperçu, un schéma). */
  preview?: ReactNode;
}

interface ChoiceTilesProps<T extends string> {
  /** Étiquette accessible du groupe (le titre du réglage). */
  label: string;
  value: T;
  options: readonly ChoiceTile<T>[];
  onChange: (value: T) => void;
}

/** Tailwind ne voit pas une classe composée : les colonnes sont écrites. */
const COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

/**
 * Un choix parmi quelques-uns, quand chacun mérite sa phrase (ou son aperçu) : des TUILES
 * (`.ui-tile` du socle — la retenue prend le fond et le trait de la teinte franche), en
 * `radiogroup`. Pour un choix de deux ou trois mots sans explication : `SegmentedChoice`.
 */
export function ChoiceTiles<T extends string>({ label, value, options, onChange }: ChoiceTilesProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${COLUMNS[options.length] ?? COLUMNS[3]}`}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          onClick={() => onChange(option.id)}
          className="ui-tile flex min-w-0 flex-col gap-1 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-content-primary">
            {option.icon ? <span aria-hidden className={option.id === value ? "text-accent" : "text-content-tertiary"}>{option.icon}</span> : null}
            {option.label}
          </span>
          {option.hint ? <span className="grow text-[13px] leading-relaxed text-content-secondary">{option.hint}</span> : null}
          {option.preview}
        </button>
      ))}
    </div>
  );
}
