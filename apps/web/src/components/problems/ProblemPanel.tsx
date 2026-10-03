import { memo } from "react";
import type { ProblemActionKey, ProblemModel } from "@tentacle-tv/shared";
import { Spinner } from "../ui/Spinner";
import { ProblemDetails, type ProblemTone } from "./ProblemDetails";
import { PROBLEM_ICONS, useProblemText } from "./useProblemText";

interface Props {
  model: ProblemModel;
  tone: ProblemTone;
  center?: boolean;
  onAction: (key: ProblemActionKey) => void;
  /** Le geste en cours (« Réessayer » qui tourne) : son bouton attend, les autres aussi. */
  busy?: ProblemActionKey | null;
  /** Faux sous la mascotte : elle dit déjà qu'il y a un souci. */
  showIcon?: boolean;
  /** Le focus va au geste principal à l'arrivée (clavier, télécommande). */
  autoFocus?: boolean;
}

/**
 * Le message d'erreur, en trois temps — comme sur l'Apple TV et le mobile :
 * QUOI (le titre), POURQUOI (la cause en mots de spectateur, puis une phrase
 * d'aide), QUOI FAIRE (une à trois actions, la principale d'abord), et les
 * détails repliés. Une coupure qui peut se réparer seule se dit en ambre ; le
 * reste, en rouge. Annoncé aux lecteurs d'écran à son arrivée.
 */
export const ProblemPanel = memo(function ProblemPanel({
  model, tone, center = false, onAction, busy = null, showIcon = true, autoFocus = false,
}: Props) {
  const text = useProblemText(model);
  const player = tone === "player";
  const Icon = PROBLEM_ICONS[model.icon];
  const chip = model.transient
    ? (player ? "bg-amber-400/15 text-amber-300" : "bg-status-warning-bg text-status-warning-fg")
    : (player ? "bg-red-500/15 text-red-300" : "bg-status-error-bg text-status-error-fg");
  return (
    <div className={`flex w-full max-w-xl flex-col gap-4 ${center ? "items-center text-center" : "items-start text-left"}`}>
      <div role="alert" className={`flex flex-col gap-2 ${center ? "items-center" : "items-start"}`}>
        {showIcon && (
          <span aria-hidden className={`mb-0.5 grid h-10 w-10 place-items-center rounded-full ${chip}`}>
            <Icon size={20} />
          </span>
        )}
        <h2 className={`text-xl font-bold tracking-tight md:text-2xl ${player ? "text-white" : "text-content-primary"}`}>{text.title}</h2>
        <p className={`text-base font-medium leading-relaxed ${player ? "text-white/90" : "text-content-primary"}`}>{text.reason}</p>
        {text.hint && <p className={`text-sm leading-relaxed ${player ? "text-white/65" : "text-content-secondary"}`}>{text.hint}</p>}
      </div>
      {text.actions.length > 0 && (
        <div className={`mt-1 flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
          {text.actions.map((action, index) => {
            const primary = index === 0;
            const waiting = busy === action.key;
            const look = primary
              ? (player ? "bg-white text-black hover:bg-white/85" : "border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg hover:bg-cta-primary-bg-hover")
              : (player ? "border border-white/30 bg-black/35 text-white/90 hover:bg-white/10" : "border border-line-strong bg-fill-subtle text-content-primary hover:bg-fill-soft");
            return (
              <button
                key={action.key}
                type="button"
                autoFocus={autoFocus && primary}
                onClick={() => onAction(action.key)}
                disabled={busy !== null}
                aria-busy={waiting}
                className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus disabled:cursor-not-allowed ${look} ${busy !== null && !waiting ? "opacity-45" : ""}`}
              >
                {waiting && <Spinner size="sm" tone="neutral" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
      <ProblemDetails lines={text.details} copy={text.copy} tone={tone} center={center} />
    </div>
  );
});
