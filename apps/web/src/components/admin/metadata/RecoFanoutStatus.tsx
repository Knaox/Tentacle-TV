import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, Info, LoaderCircle } from "lucide-react";
import type { AdminRecoFanout } from "@tentacle-tv/api-client";
import { useInViewport } from "../../../hooks/useInViewport";
import { fanoutView, relativeWhen } from "./recoFanout";

/** « il y a 5 minutes » se tient à la minute ; rien ne bat fenêtre cachée. */
function useMinuteTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

interface RecoFanoutStatusProps {
  fanout: AdminRecoFanout | undefined;
  /** Heure de la dernière lecture de l'état : l'horloge ne passe jamais derrière. */
  readAt: number;
}

/**
 * Le calcul des recommandations que la pose d'une clé déclenche pour tous
 * les comptes — le serveur le mesurait, la page ne l'affichait pas. Pendant
 * la passe : une barre et un compteur, sondés par la page toutes les 4 s.
 * Après : le bilan de la dernière passe, échecs à part.
 *
 * Coût GPU : la barre n'anime que `transform`, et l'icône de calcul — la
 * seule boucle — s'arrête hors écran et fenêtre cachée.
 */
export const RecoFanoutStatus = memo(function RecoFanoutStatus({ fanout, readAt }: RecoFanoutStatusProps) {
  const { t, i18n } = useTranslation("adminMetadata");
  const view = fanoutView(fanout);
  const settled = view?.kind === "done" || view?.kind === "interrupted";
  const now = Math.max(useMinuteTick(settled), readAt);
  const { ref, visible } = useInViewport<HTMLDivElement>();

  if (!view) return null;

  if (view.kind === "done" || view.kind === "interrupted") {
    const when = relativeWhen(view.finishedAt, now, i18n.language) ?? t("justNow");
    return (
      <div className="flex items-start gap-2 border-t border-line-subtle pt-4 text-sm leading-relaxed text-content-tertiary">
        {view.kind === "done" ? (
          <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-status-success-fg" />
        ) : (
          <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
        )}
        <p className="min-w-0">
          {view.kind === "done"
            ? t("fanoutDone", { count: view.upToDate, when })
            : t("fanoutInterrupted", { when, processed: view.processed, total: view.total })}
          {view.kind === "done" && view.failed > 0 && (
            <span className="text-status-warning-fg"> {t("fanoutFailed", { count: view.failed })}</span>
          )}
        </p>
      </div>
    );
  }

  const running = view.kind === "running";
  const ratio = running ? view.processed / view.total : 0;
  return (
    <div ref={ref} className="space-y-2.5 rounded-lg border border-line-subtle bg-fill-faint p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-2 font-medium text-content-primary">
          <LoaderCircle
            aria-hidden
            size={16}
            className="animate-spin text-brand-light"
            style={{ animationPlayState: visible ? "running" : "paused" }}
          />
          {t("fanoutTitle")}
        </span>
        <span className="tabular-nums text-content-tertiary">
          {running ? t("fanoutProgress", { count: view.total, processed: view.processed }) : t("fanoutPreparing")}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("fanoutProgressLabel")}
        aria-valuemin={0}
        aria-valuemax={running ? view.total : undefined}
        aria-valuenow={running ? view.processed : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-fill-soft"
      >
        <div
          className="h-full origin-left rounded-full bg-brand transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <p className="text-xs leading-relaxed text-content-tertiary">{t("fanoutRunningHint")}</p>
    </div>
  );
});
