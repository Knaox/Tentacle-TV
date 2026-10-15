import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { DeletionRunState, DeletionRunSummary } from "@tentacle-tv/api-client";
import { confirmationPreview } from "@tentacle-tv/shared";
import { DIALOG_CANCEL } from "./dialogButtons";

/** Des noms de titres, les premiers seulement, puis « et N autres ». */
export function TitleList({ items, more, className = "" }: {
  items: readonly { name: string; type?: string }[];
  more: number;
  className?: string;
}) {
  const { t } = useTranslation("libraryDelete");
  return (
    <ul className={`space-y-1 text-sm text-content-secondary ${className}`}>
      {items.map((item, i) => (
        <li key={`${item.name}-${i}`} className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium text-content-primary" title={item.name}>{item.name}</span>
          {item.type && t(`types.${item.type}`, { defaultValue: "" }) && (
            <span className="shrink-0 text-xs text-content-tertiary">{t(`types.${item.type}`)}</span>
          )}
        </li>
      ))}
      {more > 0 && <li className="text-content-tertiary">{t("andMore", { count: more })}</li>}
    </ul>
  );
}

export function DeletionProgressView({ titleId, descId, state, onStop }: {
  titleId: string;
  descId: string;
  state: Extract<DeletionRunState, { phase: "running" }>;
  onStop: () => void;
}) {
  const { t } = useTranslation("libraryDelete");
  const percent = state.total === 0 ? 0 : Math.round((state.processed / state.total) * 100);
  return (
    <>
      <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("progressTitle")}</h2>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-valuenow={state.processed}
        aria-labelledby={titleId}
        className="mt-5 h-2 overflow-hidden rounded-full bg-fill-soft"
      >
        {/* Une échelle, pas une largeur animée : seul `transform` bouge (règle « Coût GPU »). */}
        <div
          className="h-full origin-left rounded-full bg-[var(--brand)] transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <p className="mt-2 text-sm tabular-nums text-content-secondary" aria-live="polite">
        {t("progress", { done: state.processed, total: state.total })}
      </p>
      <p id={descId} className="mt-1 text-xs text-content-tertiary">{t("progressHint")}</p>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onStop} disabled={state.stopping} className={DIALOG_CANCEL}>
          {state.stopping ? t("stopping") : t("stop")}
        </button>
      </div>
    </>
  );
}

function Outcome({ text, ids, nameOf }: { text: string; ids: readonly string[]; nameOf: (id: string) => string }) {
  const preview = confirmationPreview(ids.map(nameOf));
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-content-primary">{text}</p>
      <TitleList className="mt-1.5 pl-1" items={preview.names.map((name) => ({ name }))} more={preview.more} />
    </div>
  );
}

export function DeletionSummaryView({ titleId, descId, summary, nameOf, onRetry, onClose }: {
  titleId: string;
  descId: string;
  summary: DeletionRunSummary;
  nameOf: (id: string) => string;
  onRetry: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("libraryDelete");
  const deleted = summary.removed.length - summary.gone.length;
  const retryable = [...summary.failed, ...summary.skipped];
  const complete = summary.forbidden.length === 0 && retryable.length === 0;
  const Icon = complete ? CheckCircle2 : AlertCircle;
  return (
    <>
      <div className="flex items-center gap-2.5">
        <Icon className={`h-6 w-6 shrink-0 ${complete ? "text-[var(--status-success-fg)]" : "text-[var(--status-warning-fg)]"}`} strokeWidth={2.2} aria-hidden />
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
          {t(complete ? "doneTitle" : "partialTitle")}
        </h2>
      </div>
      <div id={descId} role="status" className="mt-3">
        <p className="text-sm text-content-secondary">
          {deleted > 0 ? t("removed", { count: deleted }) : t("removedNone")}
          {summary.gone.length > 0 && <> {t("gone", { count: summary.gone.length })}</>}
        </p>
        {summary.forbidden.length > 0 && (
          <Outcome text={t("forbidden", { count: summary.forbidden.length })} ids={summary.forbidden} nameOf={nameOf} />
        )}
        {summary.failed.length > 0 && (
          <Outcome text={t("failed", { count: summary.failed.length })} ids={summary.failed} nameOf={nameOf} />
        )}
        {summary.skipped.length > 0 && (
          <Outcome text={t("skipped", { count: summary.skipped.length })} ids={summary.skipped} nameOf={nameOf} />
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        {retryable.length > 0 && (
          <button type="button" onClick={() => onRetry(retryable)} className={DIALOG_CANCEL}>{t("retry")}</button>
        )}
        <button type="button" onClick={onClose} className={DIALOG_CANCEL}>{t("close")}</button>
      </div>
    </>
  );
}
