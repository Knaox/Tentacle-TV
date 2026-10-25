/**
 * Octave — l'attente d'une page (squelettes à la place EXACTE du contenu :
 * mêmes hauteurs de rangée, de carte et de tête, jamais un spinner plein
 * écran) et ses états vides ou en erreur. Un état vide dit ce qui manque et,
 * quand il y en a un, le geste qui le remplit.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { CardSkeleton } from "./CardRow";
import { CARD_GRID_CLASS } from "./cardGrid";

/** Des rangées de titres en attente — la hauteur d'une `TrackRow` (56 px). */
export function RowsSkeleton({ rows = 8, showArtwork = true }: { rows?: number; showArtwork?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-2">
          <div className="flex w-8 justify-center">
            <div className="h-3 w-4 rounded bg-fill-subtle" />
          </div>
          {showArtwork && <div className="h-10 w-10 shrink-0 rounded-md bg-fill-soft" />}
          <div className="flex flex-1 flex-col gap-2">
            {/* Des largeurs qui varient : une liste, pas un code-barres. */}
            <div className="h-3 rounded bg-fill-soft" style={{ width: `${28 + ((i * 17) % 22)}%` }} />
            <div className="h-2.5 rounded bg-fill-subtle" style={{ width: `${16 + ((i * 11) % 14)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Une grille de cartes en attente, aux mesures de `CardGrid`. */
export function CardsSkeleton({ count = 6, round = false }: { count?: number; round?: boolean }) {
  return (
    <div aria-hidden className={CARD_GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} round={round} />
      ))}
    </div>
  );
}

/** La tête d'une collection en attente : image, surtitre, titre, ligne de détails ET la rangée d'actions. */
export function HeaderSkeleton({ round = false }: { round?: boolean }) {
  return (
    <div aria-hidden className="px-4 pb-6 pt-8 md:px-8">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
        <div className={`h-44 w-44 shrink-0 bg-fill-soft md:h-56 md:w-56 ${round ? "rounded-full" : "rounded-lg"}`} />
        <div className="flex w-full flex-1 flex-col gap-3">
          <div className="h-3 w-20 rounded bg-fill-subtle" />
          <div className="h-10 w-2/3 rounded bg-fill-soft md:h-12" />
          <div className="h-3 w-1/3 rounded bg-fill-subtle" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-12 w-36 rounded-full bg-fill-soft" />
        <div className="h-12 w-32 rounded-full bg-fill-subtle" />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  /** Une icône (lucide) au-dessus du titre. */
  icon?: LucideIcon;
  /** Ce qui manque, en une phrase courte. */
  title?: string;
  /** L'explication, ou un texte libre. */
  children?: ReactNode;
  /** Le geste qui remplit la page (un lien, un bouton). */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center md:px-8">
      {Icon && (
        <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-fill-subtle text-content-secondary" aria-hidden>
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      )}
      {title && <h2 className="text-lg font-bold text-content-primary">{title}</h2>}
      {children && <div className="max-w-md text-sm leading-relaxed text-content-tertiary">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Le lien ou bouton d'un état vide : une capsule discrète, cible de 40 px. */
export const EMPTY_ACTION_CLASS =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useTranslation("music");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-content-secondary">{message ?? t("common.error")}</p>
      <button type="button" onClick={onRetry} className={EMPTY_ACTION_CLASS}>
        {t("common.retry")}
      </button>
    </div>
  );
}
