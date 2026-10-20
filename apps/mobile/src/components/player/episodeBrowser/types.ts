import type { ReactNode } from "react";
import type { EpisodeEntry, SeasonEntry } from "../../../player/episodes/episodeBrowserModel";
import type { Rect } from "../../../player/episodes/episodeBrowserLayout";

/**
 * Ce que reçoit une mise en page de la liste des épisodes : des données déjà
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
  onPlay: (entry: EpisodeEntry) => void;
  onClose: () => void;
  /** L'image de la vidéo à l'écran : la liste se pose autour. */
  video: Rect;
  /** Le panneau debout remonte l'image en haut de l'écran : l'hôte la déplace d'autant. */
  onVideoLift?: (lift: number) => void;
  /** Une image fixe de la série (le sommaire la pose floutée sous la liste, une fois pour toutes). */
  backdropUri?: string | null;
}
