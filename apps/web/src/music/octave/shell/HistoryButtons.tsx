/**
 * Octave — ‹ › en tête de la coquille : page précédente, page suivante
 * (`useOctaveHistory`). Au téléphone, ‹ seul, et seulement s'il mène quelque part.
 */

import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOctaveHistory } from "./useOctaveHistory";
import { useOctaveGlassStage } from "../glass/glassStage";

const chip =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const HistoryButtons = memo(function HistoryButtons({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("music");
  const { canBack, canForward, back, forward } = useOctaveHistory();
  // Dans la scène de verre, ‹ › sont des pastilles du socle.
  const chipClass = useOctaveGlassStage() ? `lg-bead ${chip}` : chip;
  if (compact) {
    if (!canBack) return null;
    return (
      <button type="button" onClick={back} aria-label={t("shell.back")} title={t("shell.back")} className={`${chipClass} h-11 w-11`}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1" data-octave-history>
      <button type="button" onClick={back} disabled={!canBack} aria-label={t("shell.back")} title={t("shell.back")} className={chipClass}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" onClick={forward} disabled={!canForward} aria-label={t("shell.forward")} title={t("shell.forward")} className={chipClass}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
});
