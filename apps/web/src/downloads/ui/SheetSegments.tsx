/**
 * Un choix segmenté DANS une feuille du hors ligne (périmètre, palier Allégé) : une pilule
 * d'encre, l'option retenue en pastille NEUTRE — jamais un dégradé (docs/REFONTE-UI.md, § 3).
 *
 * Hors verre natif : les classes du socle (`.ctl-segmented`, `.ctl-segment`). En verre natif
 * (macOS 26) : le segmenté du contenu (`.lg-seg`, repère `.lg-seg-marker`), qui suit le ton de
 * la plaque — la feuille est déjà du verre, ses choix n'en sont pas une de plus.
 */

import type { ReactNode } from "react";
import { useLiquidGlassMode } from "../../theme/glass";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Une seconde ligne, plus discrète (« 4 Mb/s »). */
  hint?: string;
}

interface Props<T extends string> {
  /** Nom accessible du groupe. */
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  /** Le choix se charge : les autres options restent lisibles, le geste attend. */
  busy?: boolean;
  className?: string;
}

export function SheetSegments<T extends string>({ label, value, options, onChange, busy = false, className = "" }: Props<T>) {
  const native = useLiquidGlassMode() === "native";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${native ? "lg-seg gap-1 rounded-full p-1" : "ctl-segmented lg-segmented gap-0.5"} inline-flex max-w-full self-start overflow-x-auto [scrollbar-width:none] ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busy && !selected}
            onClick={() => onChange(option.value)}
            className={
              native
                ? "relative isolate flex flex-col items-center justify-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold leading-tight text-content-secondary transition-colors duration-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
                : "ctl-segment flex flex-col items-center justify-center px-3.5 leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            }
          >
            {native && selected && <span aria-hidden className="lg-seg-marker absolute inset-0 -z-10 rounded-full" />}
            <span className="whitespace-nowrap">{option.label}</span>
            {option.hint && <span className="num whitespace-nowrap text-[11px] font-medium text-content-tertiary">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
