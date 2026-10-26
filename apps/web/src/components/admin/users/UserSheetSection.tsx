import { useId, type ReactNode } from "react";
import { ScopeBadge } from "../../settings/ScopeBadge";

/**
 * Une rubrique de la fiche d'un compte : un intertitre discret, puis son
 * contenu. `scope="user"` : la rubrique RÈGLE quelque chose, et ce réglage ne
 * vaut que pour ce compte — la pastille « Par compte » le dit à côté du titre.
 */
export function UserSheetSection({ title, scope, children }: { title: string; scope?: "user"; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          {title}
        </h3>
        {scope ? <ScopeBadge scope={scope} /> : null}
      </div>
      {children}
    </section>
  );
}

/** Le cadre commun des lignes d'une rubrique — séparées d'un filet. */
export const SHEET_LIST = "divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-fill-faint";

/** Deux barres de chargement à la place d'une rubrique qui arrive. */
export function SheetSkeleton() {
  return (
    <div aria-hidden className={`${SHEET_LIST} space-y-2 p-4`}>
      <span className="skeleton-shimmer block h-3.5 w-1/2 rounded" />
      <span className="skeleton-shimmer block h-3 w-2/3 rounded" />
    </div>
  );
}
