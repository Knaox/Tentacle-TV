/**
 * Octave — la carte d'une playlist HORS bibliothèque (celle d'une extension) : la même que celle d'une playlist
 * Jellyfin (`components/Cards.tsx`), sa pochette, son nom, qui l'a composée ; le clic ouvre sa vue, le bouton la lit
 * d'un geste (ses titres demandés au survol, sous la clé de sa vue). Son menu (« … », clic droit, appui long) la
 * met en favori — gardé par Tentacle (`music.libraryFavorites`) : elle paraît alors dans la bibliothèque.
 */

import { memo, useMemo } from "react";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicShelfExternalPlaylist } from "@tentacle-tv/shared/music";
import { CardMenuFrame } from "../collections/CardMenuFrame";
import { Artwork } from "../components/Artwork";
import { entityTarget, octavePaths } from "../octavePaths";
import { useExternalCollection } from "./useTopPlayback";

export const ExternalPlaylistCard = memo(function ExternalPlaylistCard({ playlist }: { playlist: MusicShelfExternalPlaylist }) {
  const { t } = useTranslation("music");
  const { play, warm } = useExternalCollection();
  const target = entityTarget({ jellyfinId: null, external: playlist.external });
  const ref = { kind: "playlist" as const, playlist };
  const subtitle = playlist.owner ?? (playlist.trackCount !== null ? t("count.tracks", { count: playlist.trackCount }) : t("search.kindPlaylist"));
  const subject = useMemo(() => ({ section: "playlists" as const, item: { kind: "external" as const, playlist } }), [playlist]);
  if (!target) return null;
  return (
    <CardMenuFrame subject={subject}>
      {(menu) => (
    <Link
      {...menu}
      to={octavePaths.externalPlaylist(target)}
      className="octave-card group flex min-w-0 flex-col gap-2 rounded-lg p-2 transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <div className="relative aspect-square w-full">
        <Artwork url={playlist.artworkUrl} className="h-full w-full shadow-md" />
        <button
          type="button"
          aria-label={t("track.play", { title: playlist.title })}
          onPointerEnter={() => warm(ref, "hover")}
          onPointerDown={() => warm(ref, "press")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void play(ref);
          }}
          className="octave-card-play octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-[var(--oc-shadow-play)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
        >
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </button>
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-semibold text-content-primary">{playlist.title}</p>
        <p className="truncate text-[13px] text-content-tertiary">{subtitle}</p>
      </div>
    </Link>
      )}
    </CardMenuFrame>
  );
});
