/**
 * Octave — l'import EN COURS : les étapes (lecture, bibliothèque, création,
 * hors bibliothèque) avec la courante en avant et son compte, et une barre
 * (`transform: scaleX`, jamais une largeur animée). La boîte peut se fermer :
 * l'import continue, un avis dit sa fin.
 */

import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { importFraction, type ImportFlowState, type ImportPhase } from "@tentacle-tv/api-client";
import { SourceMark } from "./SourceMark";

const ORDER: readonly ImportPhase[] = ["reading", "matching", "creating", "outside"];

interface Props {
  titleId: string;
  state: ImportFlowState;
  outsideExpected: boolean;
  onHide: () => void;
  onCancel: () => void;
}

export function ImportProgress({ titleId, state, outsideExpected, onHide, onCancel }: Props) {
  const { t } = useTranslation("musicImport");
  const steps = outsideExpected ? ORDER : ORDER.filter((s) => s !== "outside");
  const current = steps.indexOf(state.phase);
  const fraction = importFraction(state, outsideExpected);

  const detail = (step: ImportPhase): string | null => {
    if (step === "matching" && state.total > 0) return `${t("progress", { done: state.matched, total: state.total })} · ${t("foundSoFar", { count: state.found })}`;
    if (step === "outside" && state.outside) return t("progress", { done: state.outside.processed, total: state.outside.total });
    return null;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {state.source && <SourceMark source={state.source} className="h-8 w-8" />}
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-bold tracking-tight text-content-primary">
            {state.name || t("title")}
          </h2>
          {state.source && <p className="text-sm text-content-tertiary">{t(`source.${state.source}`)}</p>}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fill-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-labelledby={titleId}>
        <div className="octave-brand-fill h-full w-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <ol className="flex flex-col gap-2.5" aria-live="polite">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const text = detail(step);
          return (
            <li key={step} className={`flex items-center gap-3 text-sm ${active ? "text-content-primary" : done ? "text-content-secondary" : "text-content-quaternary"}`} aria-current={active ? "step" : undefined}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {done ? <Check className="h-4 w-4 text-octave-accent-text" aria-hidden /> : active ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
              </span>
              <span className="font-medium">{t(`step.${step}`)}</span>
              {active && text && <span className="ml-auto tabular-nums text-content-tertiary">{text}</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] cursor-pointer rounded-full px-4 text-sm font-semibold text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("cancel")}
        </button>
        <button type="button" onClick={onHide} className="min-h-[44px] cursor-pointer rounded-full border border-line-subtle px-5 text-sm font-semibold text-content-primary hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("hide")}
        </button>
      </div>
    </div>
  );
}
