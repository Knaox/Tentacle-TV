import type { ReactNode } from "react";
import type { EpisodeEntry, SeasonEntry } from "../../../player/episodes/episodeBrowserModel";
import type { Rect } from "../../../player/episodes/episodeBrowserLayout";

/**
 * Ce que reçoit la liste des épisodes du lecteur : des données déjà
 * dans la forme de la liste (`episodeBrowserModel`), d'où qu'elles viennent —
 * le serveur, l'appareil, le banc d'UI. Les vignettes sont rendues par
 * l'hôte (image du serveur, fichier gardé, image du banc).
 */
export interface EpisodeBrowserProps {
  seriesTitle: string;
  seasons: readonly SeasonEntry[];
  activeSeasonId: string | undefined;
  onSelectSeason: (id: string) => void;
  /** Le doigt se pose sur une saison : de quoi la précharger avant le relâché. */
  onSeasonIntent?: (id: string) => void;
  episodes: readonly EpisodeEntry[];
  /** Les épisodes de la saison ne sont pas encore là. */
  loading: boolean;
  renderArtwork: (entry: EpisodeEntry) => ReactNode;
  /** La pastille d'états d'un épisode (le modèle des cartes) ; absente : « vu » seul. */
  renderMarkers?: (entry: EpisodeEntry) => ReactNode;
  onPlay: (entry: EpisodeEntry) => void;
  onClose: () => void;
  /** L'image de la vidéo à l'écran : debout, la liste se pose dessous. */
  video: Rect;
}
