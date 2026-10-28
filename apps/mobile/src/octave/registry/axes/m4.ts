/**
 * Octave (mobile) — ce que l'axe `m4` branche dans la coquille (playlists : `liked`, `playlists`, `playlist`),
 * l'hôte de ses feuilles (gérer, créer, renommer, partager, importer) et celui de la musique en direct, montés une
 * fois au-dessus de tout.
 * Seul `m4` édite ce fichier.
 */

import { createElement } from "react";
import { OctaveEventsHost } from "../../events/OctaveEventsHost";
import { OctaveLikedScreen, OctavePlaylistScreen, OctavePlaylistsScreen, PlaylistSheetsHost } from "../../playlists";
import { ReleaseSheetHost } from "../../releases";
import type { OctaveAxisContribution, OctaveScreenProps } from "../octaveRegistryTypes";

function PlaylistRoute({ params }: OctaveScreenProps) {
  return createElement(OctavePlaylistScreen, { key: params.id, id: params.id ?? "" });
}

export const m4Contribution: OctaveAxisContribution = {
  screens: {
    liked: OctaveLikedScreen,
    playlists: OctavePlaylistsScreen,
    playlist: PlaylistRoute,
  },
  // Les évènements `music:*` (synchro entre appareils) : UNE souscription pour toute la coquille.
  overlays: [OctaveEventsHost, PlaylistSheetsHost, ReleaseSheetHost],
};
