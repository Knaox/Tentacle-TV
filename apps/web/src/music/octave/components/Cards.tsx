/**
 * Octave — les cartes : album, artiste, playlist. Pochette carrée (place
 * réservée), titre, sous-titre. Le bouton lecture monte au survol (opacité +
 * transform) — toujours visible sur un écran tactile ; le clic sur la carte
 * ouvre sa vue. Un titre coupé se lit en entier dans l'infobulle. Parmi des
 * albums d'ailleurs, celui que la bibliothèque a porte sa pastille AU REPOS,
 * dans le coin haut gauche (`ownership` : en entier, ou « En partie ») —
 * jamais au centre de l'image, le bouton lecture garde le bas droit. Un album qui ne se LIT pas
 * (`isUnavailableAlbum` : absent de YouTube) est GRISÉ, dit « Pas lisible » au même coin, et le clic ouvre sa
 * boîte (aimer, ajouter à une playlist) au lieu de sa vue.
 */

import { memo, useState } from "react";
import { CloudOff, Library, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { openUnavailableAlbum } from "@tentacle-tv/api-client";
import type { MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { isUnavailableAlbum, playlistTrackTotal } from "@tentacle-tv/shared/octave";
import { useCollectionPlayback, type CollectionRef } from "../actions/useCollectionPlayback";
import { rememberAlbumPreview } from "../data/albumPreview";
import { useEntityIntent } from "../data/entityIntent";
import type { AlbumOwnership } from "../library/ownedItems";
import { entityTarget, octavePaths } from "../octavePaths";
import { Artwork } from "./Artwork";
import { CARD_GRID_CLASS } from "./cardGrid";
import { CollectionSwell } from "../motion/NowSwell";
import { PlaylistArtwork, playlistCoverUrls } from "./PlaylistArtwork";
import { PlaylistMenuButton } from "../playlists/PlaylistMenu";
import { usePlaylistContextMenu } from "../playlists/usePlaylistContextMenu";
import { usePendingMusic } from "../pending/usePendingMusic";

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
      className="octave-card-play octave-hover-only octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-[var(--oc-shadow-play)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
    >
      <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
    </button>
  );
}

/** La pastille « dans la bibliothèque » d'une carte : icône ET mot (lecteurs d'écran, infobulle), fond plein. */
function OwnershipBadge({ ownership }: { ownership: AlbumOwnership }) {
  const { t } = useTranslation("music");
  const label = t(ownership === "full" ? "availability.albumFull" : "availability.albumPartial");
  return (
    <span title={label} className="pointer-events-none absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/70 px-1.5 text-[11px] font-semibold leading-none text-white shadow-[var(--oc-shadow-art)]">
      <Library className="h-3.5 w-3.5 text-status-success-fg" aria-hidden />
      {ownership === "partial" && <span aria-hidden>{t("availability.partlyShort")}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** « Pas lisible » : icône ET mot, à la place de la pastille de la bibliothèque — jamais la seule couleur. */
function UnavailableBadge() {
  const { t } = useTranslation("music");
  return (
    <span className="pointer-events-none absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/70 px-2 text-[11px] font-semibold leading-none text-white shadow-[var(--oc-shadow-art)]">
      <CloudOff className="h-3.5 w-3.5" aria-hidden />
      {t("unavailableAlbum.badge")}
    </span>
  );
}

const cardClass =
  "octave-card group flex min-w-0 flex-col gap-2 rounded-[var(--oc-radius-art)] p-2 transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const AlbumCard = memo(function AlbumCard({ album, ownership = null }: { album: MusicAlbum; ownership?: AlbumOwnership | null }) {
  const { t } = useTranslation("music");
  const target = entityTarget(album);
  const intent = useEntityIntent("album", target);
  const year = album.year ? `${album.year} · ` : "";
  const artists = album.artists.map((a) => a.name).join(", ");
  const unavailable = isUnavailableAlbum(album, ownership);
  const content = (
    <>
      <div className="relative aspect-square w-full">
        <Artwork url={album.artworkUrl} label={album.title} radius="art" className={`h-full w-full shadow-[var(--oc-shadow-art)] ${unavailable ? "opacity-50 grayscale" : ""}`} />
        {unavailable && <UnavailableBadge />}
        {ownership && <OwnershipBadge ownership={ownership} />}
        <CollectionSwell contextId={target ? `album:${target}` : null} />
        {album.jellyfinId && <PlayOverlay refOf={{ kind: "album", id: album.jellyfinId }} label={t("track.play", { title: album.title })} />}
      </div>
      <div className="min-w-0 px-0.5">
        <p className={`truncate text-sm font-semibold leading-5 ${unavailable ? "text-content-tertiary" : "text-content-primary"}`} title={album.title}>
          {album.title}
        </p>
        <p className="truncate text-[13px] leading-5 text-content-tertiary" title={artists}>
          {year}
          {artists}
        </p>
      </div>
    </>
  );
  if (unavailable) {
    return (
      <button type="button" className={`${cardClass} cursor-pointer text-left`} aria-label={t("unavailableAlbum.cardLabel", { title: album.title })} onClick={() => openUnavailableAlbum(album)}>
        {content}
      </button>
    );
  }
  return target ? (
    // Un album hors bibliothèque : sa vue s'ouvre sur ce que la carte montre déjà (`albumPreview.ts`).
    <Link to={octavePaths.album(target)} className={cardClass} onClick={album.jellyfinId ? undefined : () => rememberAlbumPreview(target, album)} {...intent}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
});

export const ArtistCard = memo(function ArtistCard({ artist }: { artist: MusicArtist }) {
  const { t } = useTranslation("music");
  const target = entityTarget(artist);
  const intent = useEntityIntent("artist", target);
  const content = (
    <>
      <Artwork url={artist.imageUrl} kind="artist" label={artist.name} round className="aspect-square w-full shadow-[var(--oc-shadow-art)]" />
      <div className="min-w-0 px-0.5 text-center">
        <p className="truncate text-sm font-semibold leading-5 text-content-primary" title={artist.name}>
          {artist.name}
        </p>
        <p className="truncate text-[13px] leading-5 text-content-tertiary">{t("artist.kicker")}</p>
      </div>
    </>
  );
  return target ? (
    <Link to={octavePaths.artist(target)} className={cardClass} {...intent}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
});

export const PlaylistCard = memo(function PlaylistCard({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("music");
  // Gérer la playlist (« … » au survol, ou clic droit) : seulement si le compte peut la modifier.
  const context = usePlaylistContextMenu(playlist);
  // Les ajouts hors bibliothèque en attente comptent, comme sur la page de la playlist.
  const pending = usePendingMusic();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="group/playlist relative min-w-0">
    <Link to={octavePaths.playlist(playlist.jellyfinId)} className={cardClass} onContextMenu={context.onContextMenu}>
      <div className="relative aspect-square w-full">
        <PlaylistArtwork urls={playlistCoverUrls(playlist)} label={playlist.name} radius="art" className="h-full w-full shadow-[var(--oc-shadow-art)]" />
        <CollectionSwell contextId={`playlist:${playlist.jellyfinId}`} />
        <PlayOverlay refOf={{ kind: "playlist", id: playlist.jellyfinId }} label={t("track.play", { title: playlist.name })} />
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold leading-5 text-content-primary" title={playlist.name}>
          {playlist.name}
        </p>
        <p className="truncate text-[13px] leading-5 text-content-tertiary">{t("count.tracks", { count: playlistTrackTotal(playlist.trackCount, pending, playlist.jellyfinId) })}</p>
      </div>
    </Link>
    <div className={`absolute bottom-2 right-1 ${menuOpen ? "" : "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/playlist:opacity-100 [@media(hover:none)]:opacity-100"}`}>
      <PlaylistMenuButton playlist={playlist} open={menuOpen} onOpenChange={setMenuOpen} className="h-9 w-9" />
    </div>
    {context.menu}
    </div>
  );
});

/**
 * Une grille de cartes qui suit la largeur de SA colonne (pas celle de la
 * fenêtre : la barre latérale et la file ouverte la rétrécissent) — 2 colonnes
 * au téléphone, autant que la place en tient au-delà.
 */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className={CARD_GRID_CLASS}>{children}</div>;
}

/** Une étagère : un titre de section, éventuellement « Tout afficher », puis son contenu. */
export function Shelf({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-2">
        <h2 className="oc-heading text-xl text-content-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
