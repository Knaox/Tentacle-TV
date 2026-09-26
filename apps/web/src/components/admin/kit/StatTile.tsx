import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * La tuile de chiffre : une étiquette, un nombre qui se lit de loin, une ligne
 * de contexte. Avec `to`, la tuile ENTIÈRE est le lien vers la section qui
 * permet d'agir — pas un petit « voir » à viser dans un coin.
 *
 * `tone` teinte l'icône, et la valeur quand elle demande de l'attention
 * (`warning`, `error`) : trois tickets ouverts se voient avant d'être lus.
 * `loading` pose un squelette de la taille finale — la grille ne saute pas
 * quand les chiffres arrivent. `value` absent : un tiret, la ligne de
 * contexte dit pourquoi.
 */

export type StatTone = "default" | "success" | "warning" | "error" | "brand";

const ICON_TONE: Record<StatTone, string> = {
  default: "bg-fill-soft text-content-secondary",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
};

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-content-primary",
  success: "text-content-primary",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  brand: "text-content-primary",
};

export interface StatTileProps {
  label: string;
  /** La valeur principale. `null` ou absente : un tiret. */
  value?: ReactNode;
  /** La ligne de contexte sous la valeur. */
  hint?: ReactNode;
  /** Icône Lucide, 18 px. */
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
  /** Destination : la tuile entière devient un lien. */
  to?: string;
  className?: string;
}

export function StatTile({ label, value, hint, icon, tone = "default", loading = false, to, className }: StatTileProps) {
  const body = (
    <>
      {/* Sous 640 px (deux tuiles par rangée sur téléphone), l'icône passe
          au-dessus de l'étiquette : à côté, « Mises à jour de plugins » se
          repliait sur trois lignes. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-content-secondary">{label}</span>
        {to ? (
          <ChevronRight
            aria-hidden="true"
            size={16}
            className="hidden flex-shrink-0 text-content-quaternary opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
          />
        ) : null}
      </div>
      {loading ? (
        <div aria-hidden="true" className="mt-4 space-y-2">
          <div className="skeleton-shimmer h-8 w-16 rounded-lg" />
          <div className="skeleton-shimmer h-3 w-28 rounded" />
        </div>
      ) : (
        <>
          <p className={`mt-3 text-3xl font-semibold leading-none tracking-tight tabular-nums ${VALUE_TONE[tone]}`}>
            {value ?? "—"}
          </p>
          {hint ? <p className="mt-2 text-xs leading-snug text-content-tertiary">{hint}</p> : null}
        </>
      )}
    </>
  );

  const base = `group flex min-h-[128px] flex-col rounded-2xl border border-line-subtle bg-fill-faint p-4 ${className ?? ""}`;

  if (to) {
    return (
      <Link
        to={to}
        aria-busy={loading || undefined}
        className={`${base} transition-colors duration-150 hover:border-line-strong hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div aria-busy={loading || undefined} className={base}>
      {body}
    </div>
  );
}
