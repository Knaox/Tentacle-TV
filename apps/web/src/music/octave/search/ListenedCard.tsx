/**
 * Octave — une carte du « déjà écouté », en RANGÉE : la recherche (en
 * surtitre), l'ALBUM écouté ensuite (vignette, titre, artiste — le clic ouvre
 * sa page) et les TITRES écoutés, chacun lisible d'un clic et dit une fois.
 * Sans album connu (un titre des résultats d'une extension), le titre lui-même
 * est la tête : jamais redit dessous (O5-1).
 *
 * Vignette de 56 px, comme les raccourcis de l'accueil : la pochette d'un titre
 * de recherche n'a souvent que 120 px — nette à cette taille même sur un écran
 * Retina, baveuse étirée sur une carte carrée (O5-2).
 *
 * Lire depuis la carte, c'est lire depuis la recherche (`search:<requête>`) :
 * même suite (la radio du titre), même mémoire.
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { Play, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import { octavePaths } from "../octavePaths";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";
import type { ListenedCard as ListenedCardModel } from "./searchHomeModel";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";
const THUMB = "h-14 w-14 rounded-[var(--oc-radius-art-sm)] shadow-[var(--oc-shadow-art)]";

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
      className={`group/track flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left text-[13px] text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary ${FOCUS}`}
    >
      <Play className="h-3 w-3 shrink-0 text-content-tertiary group-hover/track:text-octave-accent-text" fill="currentColor" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{track.title}</span>
    </button>
  );
}

/** La tête : l'album (lien vers sa page) ou, sans album connu, le titre (lecture). */
function Head({ card, contextId }: { card: ListenedCardModel; contextId: string }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const { album } = card;
  const lead = card.tracks[0] as MusicTrack;
  const title = album?.title ?? lead.title;
  const body = (
    <>
      <Artwork url={album?.artworkUrl ?? lead.artworkUrl} alt="" className={THUMB} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1 text-xs text-content-tertiary">
          <Search className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{t("search.listenedFrom", { query: card.query })}</span>
        </span>
        <span className="mt-0.5 truncate text-sm font-semibold text-content-primary">{title}</span>
        <span className="truncate text-[13px] text-content-tertiary">{album?.artists ?? lead.artists.map((a) => a.name).join(", ")}</span>
      </span>
    </>
  );
  const className = `flex min-w-0 items-center gap-3 rounded-lg text-left ${FOCUS}`;
  if (album?.target) {
    return (
      <Link to={octavePaths.album(album.target)} aria-label={t("search.openAlbum", { title })} className={className}>
        {body}
      </Link>
    );
  }
  if (album) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={() => player.playList(card.tracks, 0, contextId)} aria-label={t("track.play", { title })} className={`${className} cursor-pointer`}>
      {body}
    </button>
  );
}

export const ListenedCard = memo(function ListenedCard({ card }: { card: ListenedCardModel }) {
  const contextId = `search:${card.query}`;
  // Sous un album, ses titres écoutés ; sans album, la tête EST le premier titre : seulement les suivants.
  const first = card.album ? 0 : 1;
  return (
    <article className="flex min-w-0 flex-col gap-1.5 rounded-xl p-2 transition-colors duration-150 hover:bg-octave-hover">
      <Head card={card} contextId={contextId} />
      {/* Place réservée pour deux titres : les cartes d'une rangée gardent la même hauteur. */}
      <div className="flex h-[3.75rem] flex-col gap-1 pl-[4.25rem]">
        {card.tracks.slice(first).map((track, i) => (
          <TrackButton key={track.key} tracks={card.tracks} index={i + first} contextId={contextId} />
        ))}
      </div>
    </article>
  );
});
