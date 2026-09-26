import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck } from "lucide-react";
import { StatusPill } from "../kit";
import type { Summary } from "./serviceSummary";

/**
 * Ce que les sections de la page « Services » ajoutent au kit admin : leurs
 * pastilles, leurs états de chargement et d'échec, et leur pied d'actions.
 */

/** L'état du service, et « Non enregistré » tant qu'une modification attend. */
export function SectionBadges({ summary, dirty = false }: { summary: Summary | null; dirty?: boolean }) {
  const { t } = useTranslation("adminServices");
  return (
    <>
      {summary && <StatusPill tone={summary.tone} size="sm">{t(summary.label)}</StatusPill>}
      {dirty && <StatusPill tone="brand" size="sm" dot={false}>{t("unsaved")}</StatusPill>}
    </>
  );
}

/** Le corps d'une section qui charge : la hauteur finale, un reflet borné. */
export function SectionSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton-shimmer h-3 w-32 rounded" />
          <div className="skeleton-shimmer h-11 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Le corps d'une section que le serveur n'a pas rendue. */
export function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("adminServices");
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-status-error-bg px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-status-error-fg">{t("loadError")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80"
      >
        {t("retry")}
      </button>
    </div>
  );
}

/**
 * Le pied d'une section : à gauche le résultat du dernier essai ou échec
 * (annoncé aux lecteurs d'écran), à droite les actions.
 */
export function SectionFooter({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
      <div className="mr-auto min-w-0" aria-live="polite">{status}</div>
      {children}
    </div>
  );
}

/** Le résultat d'un essai ou d'un enregistrement, en une ligne. */
export function ResultLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${ok ? "text-status-success-fg" : "text-status-error-fg"}`}>
      <span aria-hidden="true" className="mt-px shrink-0">{ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
