import { useTranslation } from "react-i18next";
import { SelectionBarFrame } from "./collection/SelectionBarFrame";

interface SelectionToolbarProps {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  /** Un RETRAIT (d'une liste), pas une suppression : « Retirer (N) ». */
  removal?: boolean;
}

/**
 * La barre de sélection (Mes favoris, Ma liste, tickets) : le compte, « Tout sélectionner »,
 * « Annuler », puis le geste qui retire — le seul en couleur. La capsule et son entrée sont
 * dans `SelectionBarFrame` ; les boutons sont les pilules du socle.
 */
export function SelectionToolbar({ count, onSelectAll, onCancel, onDelete, isDeleting, removal = false }: SelectionToolbarProps) {
  const { t } = useTranslation("common");
  return (
    <SelectionBarFrame status={t("common:selectedCount", { count })}>
      <button type="button" onClick={onSelectAll} className="lg-fb-btn btn btn-ghost btn-sm">
        {t("common:selectAll")}
      </button>
      <button type="button" onClick={onCancel} className="lg-fb-btn btn btn-soft btn-sm">
        {t("common:cancel")}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0 || isDeleting}
        className="lg-fb-btn lg-fb-danger btn btn-danger btn-sm"
      >
        {isDeleting ? t("common:loading") : t(removal ? "common:removeCount" : "common:deleteCount", { count })}
      </button>
    </SelectionBarFrame>
  );
}
