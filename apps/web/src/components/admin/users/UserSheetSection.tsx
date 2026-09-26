import { useId, type ReactNode } from "react";

/** Une rubrique de la fiche d'un compte : un intertitre discret, puis son contenu. */
export function UserSheetSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
        {title}
      </h3>
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
