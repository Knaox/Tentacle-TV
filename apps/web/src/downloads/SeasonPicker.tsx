/**
 * Sélecteur de saison d'une série téléchargée.
 *
 * Rendu VIDE quand il n'y a qu'une saison : un choix entre une seule option
 * n'est pas un choix, c'est un clic de plus et une ligne d'interface en trop.
 */

import { useTranslation } from "react-i18next";
import { seasonLabel, type OfflineSeasonGroup } from "@tentacle-tv/offline-core";
import { SheetSegments } from "./ui/SheetSegments";

interface SeasonPickerProps {
  seasons: OfflineSeasonGroup[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function SeasonPicker({ seasons, activeKey, onSelect }: SeasonPickerProps) {
  const { t } = useTranslation("downloads");
  if (seasons.length < 2) return null;

  return (
    <SheetSegments
      className="mb-5"
      label={t("detailEpisodesOnDevice")}
      value={activeKey}
      onChange={onSelect}
      options={seasons.map((season) => ({
        value: season.key,
        label: (
          <>
            {seasonLabel(t, season.seasonNumber)}
            <span className="num ml-1.5 text-xs font-medium text-content-tertiary">{season.episodes.length}</span>
          </>
        ),
      }))}
    />
  );
}
