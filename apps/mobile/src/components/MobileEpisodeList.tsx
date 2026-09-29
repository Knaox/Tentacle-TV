import type { ReactNode, RefObject } from "react";
import { View, type ScrollView } from "react-native";
import { useSeasonBrowser } from "@tentacle-tv/api-client";
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
  /** Fiche d'une SÉRIE : la liste s'ouvre sur la saison de l'épisode à reprendre. */
  followResume?: boolean;
  /**
   * ScrollView porteur : la ligne de l'épisode courant s'y amène d'elle-même à
   * l'ouverture — une saison longue ne se parcourt plus à la main.
   */
  scrollTargetRef?: RefObject<ScrollView | null>;
  /** Pilule ajoutée à la barre de saison (« Toute la saison »). */
  seasonTrailing?: (episodes: MediaItem[]) => ReactNode;
  /** Bouton ajouté au bout de chaque ligne, avant son « ⋯ » (les actions de la carte). */
  rowLeading?: (ep: MediaItem) => ReactNode;
  /**
   * L'appui long d'une ligne — la feuille des cartes sur la fiche. Absent
   * dans le lecteur : une feuille n'a rien à faire par-dessus la vidéo.
   */
  onLongPressEpisode?: (ep: MediaItem) => void;
}

/**
 * La liste des épisodes d'une série : les pastilles de saison, puis les
 * épisodes de la saison active. Orchestrateur seulement — les morceaux vivent
 * dans `episodes/` (règle des 300 lignes), et les deux emplacements optionnels
 * accueillent les boutons du hors ligne.
 *
 * La mécanique est celle de toutes les plateformes (`useSeasonBrowser`) : la
 * saison en cours d'emblée (la liste chargeait la saison 1, sources comprises,
 * puis sautait), liste légère puis sources, voisines préchargées, préchargement
 * dès que le doigt se pose sur une pastille.
 */
export function MobileEpisodeList({ seriesId, onPlay, currentEpisodeId, initialSeasonId, followResume = false, scrollTargetRef, seasonTrailing, rowLeading, onLongPressEpisode }: Props) {
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    followResume,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
  });
  const { seasons, selectedSeasonId, episodes } = browser;

  return (
    <View style={{ marginTop: 24 }}>
      {seasons && seasons.length > 0 && (
        <SeasonPills
          seasons={seasons}
          activeSeasonId={selectedSeasonId}
          onSelect={browser.select}
          markedSeasonId={browser.markedSeasonId}
          onIntent={browser.prefetch}
        />
      )}

      {selectedSeasonId && episodes && episodes.length > 0 && (
        <EpisodeItems
          seriesId={seriesId}
          seasonId={selectedSeasonId}
          episodes={episodes}
          withSources={browser.withSources}
          onPlay={onPlay}
          currentEpisodeId={currentEpisodeId}
          // Le ciblage ne vaut que pour la saison de l'épisode courant — changer
          // d'onglet à la main ne doit pas re-scroller.
          scrollTargetRef={selectedSeasonId === browser.markedSeasonId ? scrollTargetRef : undefined}
          seasonTrailing={seasonTrailing}
          rowLeading={rowLeading}
          onLongPressEpisode={onLongPressEpisode}
        />
      )}
    </View>
  );
}
