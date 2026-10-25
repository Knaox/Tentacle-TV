/**
 * Octave — une carte du « déjà écouté » : la recherche (en surtitre), l'album
 * écouté ensuite (pochette, titre, artiste — le clic ouvre sa page), et le ou
 * les titres écoutés, chacun lisible d'un clic. Les cibles ne s'imbriquent
 * jamais : un lien pour l'album, un bouton par titre, le bouton lecture de la
 * pochette monté au survol comme sur les cartes d'album (`octave-card-play`).
 * Lire depuis la carte, c'est lire depuis la recherche (`search:<requête>`) :
 * même suite (la radio du titre), même mémoire.
 */

import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Play, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import { octavePaths } from "../octavePaths";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";
import type { ListenedCard as ListenedCardModel } from "./searchHomeModel";

function TrackButton({ tracks, index, contextId }: { tracks: readonly MusicTrack[]; index: number; contextId: string }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = tracks[index] as MusicTrack;
  const prefetch = usePrefetchHandlers(() => [track]);
  return (
    <button
      type="button"
      onClick={() => player.playList(tracks, index, contextId)}
      {...prefetch}
      aria-label={t("track.play", { title: track.title })}
      className="group/track flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left text-[13px] text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <Play className="h-3 w-3 shrink-0 text-content-tertiary group-hover/track:text-content-primary" fill="currentColor" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{track.title}</span>
    </button>
  );
}

export const ListenedCard = memo(function ListenedCard({ card }: { card: ListenedCardModel }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const contextId = `search:${card.query}`;
  const lead = card.tracks[0] as MusicTrack;
  const title = card.albumTitle ?? lead.title;
  // La pochette porte le lien au clavier ; le titre le redit pour la souris seulement (un seul arrêt de tabulation).
  const albumLink = (children: ReactNode, label: string | null) =>
    card.albumTarget ? (
      <Link
        to={octavePaths.album(card.albumTarget)}
        aria-label={label ?? undefined}
        aria-hidden={label === null || undefined}
        tabIndex={label === null ? -1 : undefined}
        className={`block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${label === null ? "" : "h-full"}`}
      >
        {children}
      </Link>
    ) : (
      children
    );

  return (
    <article className="octave-card flex min-w-0 flex-col gap-2 rounded-xl p-2 transition-colors duration-150 hover:bg-octave-hover">
      <div className="relative aspect-square w-full">
        {albumLink(<Artwork url={card.artworkUrl} alt="" className="h-full w-full rounded-[var(--oc-radius-art)] [box-shadow:var(--oc-shadow-art)]" />, t("search.openAlbum", { title }))}
        <button
          type="button"
          onClick={() => player.playList(card.tracks, 0, contextId)}
          aria-label={t("track.play", { title: lead.title })}
          className="octave-card-play octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
        >
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />
        </button>
      </div>
      <div className="flex min-w-0 flex-col px-0.5">
        <p className="flex min-w-0 items-center gap-1 text-xs text-content-tertiary">
          <Search className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{t("search.listenedFrom", { query: card.query })}</span>
        </p>
        {albumLink(<span className="mt-0.5 block truncate text-sm font-semibold text-content-primary hover:underline">{title}</span>, null)}
        <p className="truncate text-[13px] text-content-tertiary">{card.artists}</p>
      </div>
      {/* Place réservée pour deux titres : les cartes d'une rangée gardent la même hauteur. */}
      <div className="-mx-0.5 flex h-[4.25rem] flex-col gap-1">
        {card.tracks.map((track, i) => (
          <TrackButton key={track.key} tracks={card.tracks} index={i} contextId={contextId} />
        ))}
      </div>
    </article>
  );
});
