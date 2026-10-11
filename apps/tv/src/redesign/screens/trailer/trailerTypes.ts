import type { SubtitleCue } from "@tentacle-tv/shared";
import type { TrailerPanel, TrailerTools } from "@tentacle-tv/tv-core";
import type { TrackOptionModel } from "../player/playerTypes";

/**
 * Le modèle de la vue du lecteur de bande-annonce — un lecteur ULTRA
 * simplifié : avancer / reculer sur la barre, afficher ou non les
 * sous-titres, changer la qualité. Rien d'autre (ni épisodes, ni vitesse,
 * ni réglages). Les règles (cibles, voisins, boutons présents, options) sont
 * celles de tv-core (`player/trailerFocus.ts`, `player/trailerPanels.ts`) ;
 * la vue n'y ajoute que les libellés.
 *
 * Clés de focus : `trailer:close`, `trailer:timeline`, `trailer:subtitles`,
 * `trailer:quality` ; les panneaux, par `PlayerSheet` : `<préfixe>:close`,
 * `<préfixe>:list:<clé>` (préfixes `trailerSubtitles`, `trailerQuality` ;
 * groupes `<préfixe>:panel` et `<préfixe>:back`).
 */

/** La barre de temps, en secondes. */
export interface TrailerTimeline {
  position: number;
  duration: number;
  buffered: number;
}

/** Un panneau ouvert : une seule colonne de choix (« Désactivés » + pistes, « Auto » + paliers), libellés posés. */
export interface TrailerPanelModel {
  kind: TrailerPanel;
  options: TrackOptionModel[];
}

export type { SubtitleCue, TrailerPanel, TrailerTools };
