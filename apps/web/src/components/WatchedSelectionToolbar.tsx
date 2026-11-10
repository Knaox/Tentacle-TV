import { useTranslation } from "react-i18next";
import { SelectionBarFrame } from "./collection/SelectionBarFrame";

interface Props {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onMarkWatched: () => void;
  onMarkUnwatched: () => void;
  isBusy: boolean;
  /** Action groupée « télécharger la sélection » (desktop, droit requis) —
   *  bouton rendu UNIQUEMENT quand les deux props sont fournies. */
  onDownload?: () => void;
  downloadLabel?: string;
}

/**
 * La barre d'actions groupées de la sélection d'épisodes : marquer vu ou non vu, et garder la
 * sélection hors ligne là où c'est permis. La même capsule que les autres sélections
 * (`SelectionBarFrame`) ; « Marquer comme vu », le geste attendu, porte la teinte franche.
 */
export function WatchedSelectionToolbar({
  count,
  onSelectAll,
  onCancel,
  onMarkWatched,
  onMarkUnwatched,
  isBusy,
  onDownload,
  downloadLabel,
}: Props) {
  const { t } = useTranslation("common");
  const idle = count === 0 || isBusy;
  return (
    <SelectionBarFrame status={t("common:selectedCount", { count })}>
      <button type="button" onClick={onSelectAll} className="lg-fb-btn btn btn-ghost btn-sm">
        {t("common:selectAll")}
      </button>
      <button type="button" onClick={onCancel} className="lg-fb-btn btn btn-soft btn-sm">
        {t("common:cancel")}
      </button>
      {onDownload && downloadLabel && (
        <button type="button" onClick={onDownload} disabled={idle} className="lg-fb-btn btn btn-soft btn-sm">
          {downloadLabel}
        </button>
      )}
      <button type="button" onClick={onMarkWatched} disabled={idle} className="lg-fb-btn lg-fb-primary btn btn-accent btn-sm">
        {t("common:markWatched")}
      </button>
      <button type="button" onClick={onMarkUnwatched} disabled={idle} className="lg-fb-btn btn btn-soft btn-sm">
        {t("common:markUnwatched")}
      </button>
    </SelectionBarFrame>
  );
}
