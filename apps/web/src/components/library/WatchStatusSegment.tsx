import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "./SegmentedControl";
import { STATUS_QUICK } from "./filterChip";

interface WatchStatusSegmentProps {
  statusFilter: string | null;
  isFavorite: boolean;
  onStatusChange: (v: string | null) => void;
  onFavoriteChange: (v: boolean) => void;
}

/** Clé du segment « Tous », dont la valeur de filtre est `null`. */
const ALL = "all";

/**
 * « Tous · Non vus · En cours » en contrôle segmenté : trois états exclusifs
 * se lisent mieux d'un bloc que trois pastilles détachées.
 *
 * Le comportement est celui des pastilles qu'il remplace, à la lettre :
 * choisir un statut lève le filtre Favoris, et aucun segment n'est allumé
 * tant que Favoris l'est. `aria-selected` reste sur les boutons
 * (`semantics="selected"`) — la cible webOS y résout le filtre ACTIF quand on
 * remonte de la grille.
 */
export const WatchStatusSegment = memo(function WatchStatusSegment({
  statusFilter, isFavorite, onStatusChange, onFavoriteChange,
}: WatchStatusSegmentProps) {
  const { t } = useTranslation(["common", "library"]);
  const options = useMemo(
    () => STATUS_QUICK.map((opt) => ({ value: opt.value ?? ALL, label: t(`common:${opt.key}`) })),
    [t],
  );

  return (
    <SegmentedControl
      semantics="selected"
      label={t("library:watchStatus")}
      markerId="library-status-marker"
      options={options}
      value={isFavorite ? null : (statusFilter ?? ALL)}
      onChange={(v) => { onStatusChange(v === ALL ? null : v); onFavoriteChange(false); }}
    />
  );
});
