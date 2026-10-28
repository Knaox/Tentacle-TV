/**
 * Octave (mobile) — ce que l'axe `m4` branche dans la coquille (playlists : `liked`, `playlists`, `playlist`),
 * et l'hôte de ses feuilles (gérer, créer, renommer, partager, importer), monté une fois au-dessus de tout.
 * Seul `m4` édite ce fichier.
 */

import { createElement } from "react";
import { OctaveLikedScreen, OctavePlaylistScreen, OctavePlaylistsScreen, PlaylistSheetsHost } from "../../playlists";
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
  overlays: [PlaylistSheetsHost],
};
