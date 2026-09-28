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
  /** « Autres », « inconnue » : une barre neutre, un libellé en retrait — ce n'est pas une catégorie. */
  muted?: boolean;
}

interface HBarListProps {
  items: HBarItem[];
  ariaLabel: string;
  /** Bout d'échelle ; par défaut la plus grande valeur. */
  max?: number;
}

/**
 * Barres horizontales d'une seule série (genres, pays, langues, décennies,
 * écrans) : UNE teinte, la marque, pour toutes les barres — la longueur dit
 * la grandeur, la couleur n'a rien d'autre à dire. Fines, arrondies au bout
 * de la donnée, carrées à la base ; la valeur écrite en toutes lettres, pour
 * une liste qui se lit sans survol ni couleur.
 *
 * L'entrée ne joue que `transform` (échelle depuis la base) ; immédiate quand
 * l'utilisateur réduit les animations.
 */
export const HBarList = memo(function HBarList({ items, ariaLabel, max }: HBarListProps) {
  const reduced = useReducedMotion();
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <ul aria-label={ariaLabel} className="space-y-3.5">
      {items.map((item, index) => {
        const ratio = top > 0 ? Math.max(0.015, Math.min(1, item.value / top)) : 0;
        return (
          <li key={item.key} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className={`flex min-w-0 items-center gap-2 ${item.muted ? "text-content-tertiary" : "text-content-secondary"}`}>
                {item.icon && <span aria-hidden className="shrink-0 text-content-tertiary">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className={`font-semibold ${item.muted ? "text-content-secondary" : "text-content-primary"}`}>{item.display}</span>
                {item.secondary && <span className="ml-1.5 text-xs text-content-tertiary">{item.secondary}</span>}
              </span>
            </div>
            <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-r-[3px] bg-fill-soft">
              <motion.div
                className="h-full origin-left rounded-r-[3px]"
                style={{ width: `${ratio * 100}%`, background: item.muted ? "var(--fill-strong)" : "var(--brand)" }}
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
