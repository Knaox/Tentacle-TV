/**
 * Octave (mobile) — ce que l'axe `m3` branche dans la coquille (pages : `home`, `search`, `library`, `album`, `artist`, `externalPlaylist`, `mood`, `homeMix`).
 * Seul `m3` édite ce fichier. L'hôte des pages (feuille d'actions d'un titre, choix de playlist, avis) est monté
 * une fois au-dessus de la coquille.
 */

import { OctaveAlbumScreen } from "../../pages/entity/OctaveAlbumScreen";
import { OctaveArtistScreen } from "../../pages/entity/OctaveArtistScreen";
import { OctaveExternalPlaylistScreen } from "../../pages/entity/OctaveExternalPlaylistScreen";
import { OctaveMoodScreen } from "../../pages/entity/OctaveMoodScreen";
import { OctaveHomeMixScreen } from "../../pages/entity/OctaveHomeMixScreen";
import { OctaveHomeScreen } from "../../pages/home/OctaveHomeScreen";
import { OctaveLibraryScreen } from "../../pages/library/OctaveLibraryScreen";
import { OctaveSearchScreen } from "../../pages/search/OctaveSearchScreen";
import { OctavePagesHost } from "../../pages/actions/OctavePagesHost";
import type { OctaveAxisContribution, OctaveScreenProps } from "../octaveRegistryTypes";

// Une page par identifiant (`key`) : changer d'album ou d'artiste repart d'une page neuve.
function AlbumRoute({ params }: OctaveScreenProps) {
  const id = params.id ?? "";
  return <OctaveAlbumScreen key={id} id={id} />;
}

function ArtistRoute({ params }: OctaveScreenProps) {
  const id = params.id ?? "";
  return <OctaveArtistScreen key={id} id={id} />;
}

function ExternalPlaylistRoute({ params }: OctaveScreenProps) {
  const key = params.key ?? "";
  return <OctaveExternalPlaylistScreen key={key} id={key} />;
}

function MoodRoute({ params }: OctaveScreenProps) {
  const id = params.id ?? "";
  return <OctaveMoodScreen key={id} id={id} />;
}

function HomeMixRoute({ params }: OctaveScreenProps) {
  const id = params.id ?? "";
  return <OctaveHomeMixScreen key={id} id={id} />;
}

function PagesOverlay() {
  return <OctavePagesHost primary />;
}

export const m3Contribution: OctaveAxisContribution = {
  screens: {
    home: OctaveHomeScreen,
    search: OctaveSearchScreen,
    library: OctaveLibraryScreen,
    album: AlbumRoute,
    artist: ArtistRoute,
    externalPlaylist: ExternalPlaylistRoute,
    mood: MoodRoute,
    homeMix: HomeMixRoute,
  },
  overlays: [PagesOverlay],
};
