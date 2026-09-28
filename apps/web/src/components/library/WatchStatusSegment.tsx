import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { STATUS_QUICK } from "./filterChip";

interface WatchStatusSegmentProps {
  statusFilter: string | null;
  isFavorite: boolean;
  onStatusChange: (v: string | null) => void;
  onFavoriteChange: (v: boolean) => void;
}

/**
 * « Tous · Non vus · En cours » en contrôle segmenté : trois états exclusifs
 * se lisent mieux d'un bloc que trois pastilles détachées.
 *
 * Le comportement est celui des pastilles qu'il remplace, à la lettre :
 * choisir un statut lève le filtre Favoris, et aucun segment n'est allumé
 * tant que Favoris l'est. `aria-selected` reste sur les boutons — la cible
 * webOS y résout le filtre ACTIF quand on remonte de la grille.
 *
 * Le repère glisse d'un segment à l'autre (`layoutId`, donc `transform`) ;
 * immédiat quand l'utilisateur réduit les animations.
 */
export const WatchStatusSegment = memo(function WatchStatusSegment({
  statusFilter, isFavorite, onStatusChange, onFavoriteChange,
}: WatchStatusSegmentProps) {
  const { t } = useTranslation(["common", "library"]);
  const reduced = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={t("library:watchStatus")}
      className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong"
    >
      {STATUS_QUICK.map((opt) => {
        const selected = statusFilter === opt.value && !isFavorite;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => { onStatusChange(opt.value); onFavoriteChange(false); }}
            aria-selected={selected}
            className={`relative isolate min-h-[28px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] ${
              selected ? "text-cta-brand-fg" : "text-content-secondary hover:text-content-primary"
            }`}
          >
            {selected && (
              <motion.span
                aria-hidden
                layoutId="library-status-marker"
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))",
                  boxShadow: "0 2px 10px rgba(var(--brand-rgb),0.35)",
                }}
              />
            )}
            {t(`common:${opt.key}`)}
          </button>
        );
      })}
    </div>
  );
});
