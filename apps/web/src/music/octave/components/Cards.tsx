/**
 * Octave — les cartes : album, artiste, playlist. Pochette carrée (place
 * réservée), titre, sous-titre. Le bouton lecture monte au survol (opacité +
 * transform) ; le clic sur la carte ouvre sa vue.
 */

import { memo } from "react";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { useCollectionPlayback, type CollectionRef } from "../actions/useCollectionPlayback";
import { entityTarget, octavePaths } from "../octavePaths";
import { Artwork } from "./Artwork";

function PlayOverlay({ refOf, label }: { refOf: CollectionRef; label: string }) {
  const { play, warm } = useCollectionPlayback();
  return (
    <button
      type="button"
      aria-label={label}
      onPointerEnter={() => warm(refOf, "hover")}
      onPointerDown={() => warm(refOf, "press")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void play(refOf);
      }}
      className="octave-card-play octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
    >
      <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
    </button>
  );
}

const cardClass =
  "octave-card group flex min-w-0 flex-col gap-2 rounded-lg p-2 transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const AlbumCard = memo(function AlbumCard({ album }: { album: MusicAlbum }) {
  const { t } = useTranslation("music");
  const target = entityTarget(album);
  const year = album.year ? `${album.year} · ` : "";
  const content = (
    <>
      <div className="relative aspect-square w-full">
        <Artwork url={album.artworkUrl} className="h-full w-full shadow-md" />
        {album.jellyfinId && <PlayOverlay refOf={{ kind: "album", id: album.jellyfinId }} label={t("track.play", { title: album.title })} />}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold text-content-primary">{album.title}</p>
        <p className="truncate text-[13px] text-content-tertiary">
          {year}
          {album.artists.map((a) => a.name).join(", ")}
        </p>
      </div>
    </>
  );
  return target ? (
    <Link to={octavePaths.album(target)} className={cardClass}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
});

export const ArtistCard = memo(function ArtistCard({ artist }: { artist: MusicArtist }) {
  const { t } = useTranslation("music");
  const target = entityTarget(artist);
  const content = (
    <>
      <Artwork url={artist.imageUrl} kind="artist" round className="aspect-square w-full shadow-md" />
      <div className="min-w-0 px-0.5 text-center">
        <p className="truncate text-sm font-semibold text-content-primary">{artist.name}</p>
        <p className="truncate text-[13px] text-content-tertiary">{t("artist.kicker")}</p>
      </div>
    </>
  );
  return target ? (
    <Link to={octavePaths.artist(target)} className={cardClass}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
});

export const PlaylistCard = memo(function PlaylistCard({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("music");
  return (
    <Link to={octavePaths.playlist(playlist.jellyfinId)} className={cardClass}>
      <div className="relative aspect-square w-full">
        <Artwork url={playlist.artworkUrl} className="h-full w-full shadow-md" />
        <PlayOverlay refOf={{ kind: "playlist", id: playlist.jellyfinId }} label={t("track.play", { title: playlist.name })} />
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold text-content-primary">{playlist.name}</p>
        <p className="truncate text-[13px] text-content-tertiary">{t("count.tracks", { count: playlist.trackCount })}</p>
      </div>
    </Link>
  );
});

/** Une grille de cartes qui suit la largeur (2 colonnes au téléphone, jusqu'à 7). */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">{children}</div>;
}

/** Une étagère : un titre de section, éventuellement « Tout afficher », puis son contenu. */
export function Shelf({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-2">
        <h2 className="text-xl font-bold tracking-tight text-content-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
