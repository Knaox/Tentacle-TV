import type { ReactNode } from "react";
import { useInViewport } from "../../hooks/useInViewport";

export interface SetupWaitingProps {
  /** Ce que l'on attend, en une phrase (« Recherche des Jellyfin de votre réseau… »). */
  title: ReactNode;
  /** Pourquoi c'est long, ou ce qui viendra ensuite. */
  detail?: ReactNode;
  /** De 0 à 1 : une barre qui avance (téléchargement, étapes faites). Absent : l'anneau seul. */
  progress?: number | null;
  /** `panel` : l'attente qui occupe l'écran (un encadré) ; `inline` : une ligne dans le flux. */
  variant?: "panel" | "inline";
  /** Sous le texte : un geste possible pendant l'attente (annuler, page officielle…). */
  children?: ReactNode;
  className?: string;
}

/**
 * L'ÉTAT D'ATTENTE de l'assistant, le seul : un anneau qui tourne, ce que
 * l'on attend en toutes lettres, et, quand on sait mesurer, une barre qui
 * avance. Tout écran qui attend (recherche, chargement, installation,
 * démarrage de Jellyfin) passe par lui — jamais un squelette ni un « … »
 * recopiés.
 *
 * Annoncé aux lecteurs d'écran (`role="status"`, poli) ; l'anneau est
 * décoratif. Coût GPU : l'anneau ne tourne qu'à l'écran et fenêtre visible
 * (`useInViewport`), la barre avance par `scaleX` — rien n'est repeint.
 */
export function SetupWaiting({ title, detail, progress = null, variant = "panel", children, className = "" }: SetupWaitingProps) {
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const measured = typeof progress === "number" ? Math.min(1, Math.max(0, progress)) : null;
  const box = variant === "panel" ? "rounded-xl border border-line-subtle bg-fill-faint px-4 py-4 sm:px-5" : "";
  return (
    <div ref={ref} role="status" aria-live="polite" className={`${box} ${className}`} data-testid="setup-waiting">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[rgba(var(--brand-rgb),0.2)] border-t-[color:var(--brand)]"
          style={{ animationPlayState: visible ? undefined : "paused" }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-relaxed text-content-primary">{title}</p>
          {detail ? <p className="mt-0.5 text-sm leading-relaxed text-content-secondary">{detail}</p> : null}
        </div>
      </div>
      {measured !== null ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(measured * 100)}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill-soft"
        >
          <div
            className="h-full origin-left rounded-full transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${measured})`, background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
          />
        </div>
      ) : null}
      {children ? <div className="mt-3 pl-8">{children}</div> : null}
    </div>
  );
}
