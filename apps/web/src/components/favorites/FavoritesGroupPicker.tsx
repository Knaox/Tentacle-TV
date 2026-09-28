import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import { FAVORITES_GROUP_MODES, type FavoritesGroupMode } from "@tentacle-tv/api-client";
import { SegmentedControl } from "../library/SegmentedControl";

const LABEL_KEYS: Record<FavoritesGroupMode, string> = {
  none: "groupNone",
  type: "groupType",
  status: "groupStatus",
  genre: "groupGenre",
  decade: "groupDecade",
};

/**
 * « Regrouper » : le contrôle segmenté de la Bibliothèque (radiogroup, flèches
 * gauche/droite), précédé de son intitulé. Il ouvre l'étage du bas du
 * panneau, là où la Bibliothèque pose le statut de visionnage — que les
 * tuiles du bilan portent déjà ici.
 */
export const FavoritesGroupPicker = memo(function FavoritesGroupPicker({
  mode, onChange,
}: {
  mode: FavoritesGroupMode;
  onChange: (mode: FavoritesGroupMode) => void;
}) {
  const { t } = useTranslation("favorites");
  const options = useMemo(() => FAVORITES_GROUP_MODES.map((m) => ({ value: m, label: t(LABEL_KEYS[m]) })), [t]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-content-tertiary">
        <Layers className="h-3.5 w-3.5" strokeWidth={2.1} />
        {t("groupBy")}
      </span>
      <div className="scrollbar-hide min-w-0 overflow-x-auto">
        <SegmentedControl
          label={t("groupBy")}
          markerId="favorites-group-marker"
          options={options}
          value={mode}
          onChange={onChange}
        />
      </div>
    </div>
  );
});
