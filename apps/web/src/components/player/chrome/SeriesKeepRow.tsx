import { useTranslation } from "react-i18next";
import type { ApplyToSeriesControl } from "../../../hooks/useApplyToSeries";
import { seriesKeepLine } from "./seriesKeepLine";
import "./playerPanels.css";

interface SeriesKeepRowProps {
  control: ApplyToSeriesControl;
  /** Le nom de la série, pour la phrase (« à chaque épisode de … »). */
  seriesName?: string;
}

/**
 * « Garder pour toute la série » — la ligne du menu des pistes qui remplace la case « Appliquer à
 * cette série » (refonte de nov. 2026 : elle ne disait pas ce qu'elle faisait). Un interrupteur,
 * et dessous la phrase qui dit ce qui est gardé : l'audio ET les sous-titres, leur langue et leur
 * mode, à chaque épisode, en ligne comme hors ligne (`seriesKeepLine`).
 *
 * La logique ne change pas : `ApplyToSeriesControl` (`checked`, `pending`, `toggle`). Toute la
 * ligne est la cible ; pendant l'enregistrement elle est inerte, sans disparaître.
 *
 * Les couleurs sont des jetons : dans le panneau de verre du lecteur (`.lgp-panel`), qui les
 * redéfinit localement, la même ligne se peint juste.
 */
export function SeriesKeepRow({ control, seriesName }: SeriesKeepRowProps) {
  const { t, i18n } = useTranslation("player");
  const line = seriesKeepLine(t, i18n.language, control.choice, seriesName);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={control.checked}
      aria-disabled={control.pending || undefined}
      aria-label={t("player:keepForSeries.aria")}
      aria-describedby="player-series-keep-line"
      className="pl-series"
      onClick={() => { if (!control.pending) control.toggle(!control.checked); }}
    >
      <span className="min-w-0 flex-1">
        <span className="pl-series__title block">{t("player:keepForSeries.title")}</span>
        <span id="player-series-keep-line" className="pl-series__line block">{line}</span>
      </span>
      <span className="pl-switch" aria-hidden />
    </button>
  );
}
