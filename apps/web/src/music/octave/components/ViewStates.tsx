/**
 * Octave — l'attente d'une page (squelettes à la place exacte du contenu :
 * jamais un spinner plein écran) et ses états vides ou en erreur.
 */

import { useTranslation } from "react-i18next";

export function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-1 px-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="h-4 w-8 rounded bg-fill-soft" />
          <div className="h-10 w-10 rounded-md bg-fill-soft" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-1/3 rounded bg-fill-soft" />
            <div className="h-3 w-1/5 rounded bg-fill-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 p-2">
          <div className="aspect-square w-full rounded-md bg-fill-soft" />
          <div className="h-3 w-3/4 rounded bg-fill-soft" />
          <div className="h-3 w-1/2 rounded bg-fill-subtle" />
        </div>
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 px-4 pb-6 pt-8 md:flex-row md:items-end md:px-8">
      <div className="h-44 w-44 rounded-md bg-fill-soft md:h-56 md:w-56" />
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-3 w-20 rounded bg-fill-subtle" />
        <div className="h-10 w-2/3 rounded bg-fill-soft" />
        <div className="h-3 w-1/3 rounded bg-fill-subtle" />
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-content-tertiary md:px-8">{children}</p>;
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useTranslation("music");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-content-secondary">{message ?? t("common.error")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-content-primary hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
