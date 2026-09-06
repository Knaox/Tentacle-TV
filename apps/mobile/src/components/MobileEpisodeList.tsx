import { useState, type ReactNode, type RefObject } from "react";
import { View, type ScrollView } from "react-native";
import { useSeasons } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SeasonPills } from "./episodes/SeasonPills";
import { EpisodeItems } from "./episodes/EpisodeItems";

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  /** Épisode à surligner (« épisode actuel » / à reprendre). */
  currentEpisodeId?: string;
  /** Saison à présélectionner (saison de l'épisode courant). */
  initialSeasonId?: string;
  /**
   * ScrollView porteur : la ligne de l'épisode courant s'y amène d'elle-même à
   * l'ouverture — une saison longue ne se parcourt plus à la main.
   */
  scrollTargetRef?: RefObject<ScrollView | null>;
  /** Pilule ajoutée à la barre de saison (« Toute la saison »). */
  seasonTrailing?: (episodes: MediaItem[]) => ReactNode;
  /** Bouton ajouté à chaque ligne, à gauche du rond « vu ». */
  rowLeading?: (ep: MediaItem) => ReactNode;
}

/**
 * La liste des épisodes d'une série : les pilules de saison, puis les
 * épisodes de la saison active. Orchestrateur seulement — les morceaux vivent
 * dans `episodes/` (règle des 300 lignes), et les deux emplacements optionnels
 * accueillent les boutons du hors ligne.
 */
export function MobileEpisodeList({ seriesId, onPlay, currentEpisodeId, initialSeasonId, scrollTargetRef, seasonTrailing, rowLeading }: Props) {
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);
  const activeSeason = selectedSeason ?? initialSeasonId ?? seasons?.[0]?.Id;

  return (
    <View style={{ marginTop: 24 }}>
      {seasons && seasons.length > 0 && (
        <SeasonPills seasons={seasons} activeSeasonId={activeSeason} onSelect={setSelectedSeason} />
      )}

      {activeSeason && (
        <EpisodeItems
          seriesId={seriesId}
          seasonId={activeSeason}
          onPlay={onPlay}
          currentEpisodeId={currentEpisodeId}
          // Le ciblage ne vaut que pour la saison de l'épisode courant — changer
          // d'onglet à la main ne doit pas re-scroller.
          scrollTargetRef={selectedSeason === undefined ? scrollTargetRef : undefined}
          seasonTrailing={seasonTrailing}
          rowLeading={rowLeading}
        />
      )}
    </View>
  );
}
