import { memo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  /** La valeur écrite en bout de barre (« 32 % », « 12 h 40 »). */
  display: string;
  /** Une précision en second (la durée quand `display` est une part). */
  secondary?: string;
  icon?: ReactNode;
}

interface HBarListProps {
  items: HBarItem[];
  ariaLabel: string;
  /** Couleur de remplissage : la marque par défaut (une seule série, une seule couleur). */
  color?: string;
  /** Bout d'échelle ; par défaut la plus grande valeur. */
  max?: number;
}

/**
 * Barres horizontales d'une seule série (genres, langues, décennies,
 * écrans) : fines, arrondies au bout de la donnée, carrées à la base, et la
 * valeur écrite en toutes lettres — la liste se lit sans survol ni couleur.
 *
 * L'entrée ne joue que `transform` (échelle depuis la base) ; immédiate quand
 * l'utilisateur réduit les animations.
 */
export const HBarList = memo(function HBarList({ items, ariaLabel, color = "var(--brand)", max }: HBarListProps) {
  const reduced = useReducedMotion();
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((item, index) => {
        const ratio = top > 0 ? Math.max(0.02, Math.min(1, item.value / top)) : 0;
        return (
          <li key={item.key} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-content-secondary">
                {item.icon && <span aria-hidden className="shrink-0 text-content-tertiary">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-content-primary">{item.display}</span>
                {item.secondary && <span className="ml-1.5 text-xs text-content-tertiary">{item.secondary}</span>}
              </span>
            </div>
            <div aria-hidden className="h-2 w-full overflow-hidden rounded-r-[4px] bg-fill-soft">
              <motion.div
                className="h-full origin-left rounded-r-[4px]"
                style={{ width: `${ratio * 100}%`, background: color }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
});
