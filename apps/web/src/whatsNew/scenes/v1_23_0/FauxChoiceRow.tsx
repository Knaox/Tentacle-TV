import { motion } from "framer-motion";
import { sceneTween } from "..";

/**
 * Une rangée de préréglages de la nouvelle invitation, en faux : le libellé
 * du champ puis les pastilles de `ChoiceChips`, la choisie passée à la marque
 * par un calque en opacité. Les pastilles ont une largeur FIXE : c'est ce qui
 * permet de viser l'une d'elles au curseur (cf. `chipCenter`).
 */

export const CHIP_GAP = 6;

/** Le centre de la pastille `index`, en px depuis le bord gauche de la rangée. */
export function chipCenter(chipW: number, index: number): number {
  return index * (chipW + CHIP_GAP) + chipW / 2;
}

interface FauxChoiceRowProps {
  legend: string;
  labels: readonly string[];
  selected: number;
  chipW: number;
}

export function FauxChoiceRow({ legend, labels, selected, chipW }: FauxChoiceRowProps) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-medium text-content-tertiary">{legend}</p>
      <div className="flex" style={{ gap: CHIP_GAP }}>
        {labels.map((label, index) => {
          const on = index === selected;
          return (
            <span
              key={label}
              className="relative inline-flex h-7 items-center justify-center overflow-hidden rounded-full border border-line-subtle bg-fill-subtle text-[10.5px] font-semibold tabular-nums"
              style={{ width: chipW }}
            >
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)]"
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={sceneTween}
              />
              <span className={`relative ${on ? "text-content-primary" : "text-content-secondary"}`}>{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
