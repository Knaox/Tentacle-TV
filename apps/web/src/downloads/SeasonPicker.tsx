/**
 * Sélecteur de saison d'une série téléchargée.
 *
 * Rendu VIDE quand il n'y a qu'une saison : un choix entre une seule option
 * n'est pas un choix, c'est un clic de plus et une ligne d'interface en trop.
 */

import { useTranslation } from "react-i18next";
import { seasonLabel, type OfflineSeasonGroup } from "./offlineGroups";

interface SeasonPickerProps {
  seasons: OfflineSeasonGroup[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function SeasonPicker({ seasons, activeKey, onSelect }: SeasonPickerProps) {
  const { t } = useTranslation("downloads");
  if (seasons.length < 2) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {seasons.map((season) => {
        const actif = season.key === activeKey;
        return (
          <button
            key={season.key}
            type="button"
            aria-current={actif ? "true" : undefined}
            onClick={() => onSelect(season.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              actif
                ? "bg-fill-medium text-content-primary"
                : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            {seasonLabel(t, season.seasonNumber)}
            <span className="ml-1.5 text-xs text-content-quaternary">{season.episodes.length}</span>
          </button>
        );
      })}
    </div>
  );
}
