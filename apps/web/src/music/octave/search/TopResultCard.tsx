/**
 * Octave — le MEILLEUR RÉSULTAT, en grande carte (façon Apple Music) : la pochette (ronde pour un artiste), le nom
 * en grand, son genre et son artiste, et le bouton Lecture. Le nom mène à sa vue (album, artiste, playlist) ; pour
 * un titre, il le lit. Le bouton lit d'un geste ; survol et appui préparent. Rien ne bouge au survol que l'opacité
 * du bouton et la teinte du fond (règles GPU).
 */

import { memo, useId } from "react";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rememberAlbumPreview } from "../data/albumPreview";
import { Artwork } from "../components/Artwork";
import { entityTarget, octavePaths } from "../octavePaths";
import type { TopResult } from "./searchLayout";

interface TopResultCardProps {
  top: TopResult;
  onPlay: (top: TopResult) => void;
  onWarm: (top: TopResult, intent: "hover" | "press") => void;
}

interface Face {
  title: string;
  art: string | null;
  kind: string;
  subtitle: string;
  round: boolean;
  to: string | null;
}

function useFace(top: TopResult): Face {
  const { t } = useTranslation("music");
  const names = (artists: readonly { name: string }[]) => artists.map((a) => a.name).join(", ");
  switch (top.kind) {
    case "track":
      return { title: top.track.title, art: top.track.artworkUrl, kind: t("search.kindTrack"), subtitle: names(top.track.artists), round: false, to: null };
    case "album": {
      const target = entityTarget(top.album);
      const kind = top.album.kind === "single" ? t("search.kindSingle") : top.album.kind === "ep" ? t("search.kindEp") : t("search.kindAlbum");
      return { title: top.album.title, art: top.album.artworkUrl, kind, subtitle: names(top.album.artists), round: false, to: target ? octavePaths.album(target) : null };
    }
    case "artist": {
      const target = entityTarget(top.artist);
      return { title: top.artist.name, art: top.artist.imageUrl, kind: t("search.kindArtist"), subtitle: "", round: true, to: target ? octavePaths.artist(target) : null };
    }
    default: {
      const target = entityTarget({ jellyfinId: null, external: top.playlist.external });
      return { title: top.playlist.title, art: top.playlist.artworkUrl, kind: t("search.kindPlaylist"), subtitle: top.playlist.owner ?? "", round: false, to: target ? octavePaths.externalPlaylist(target) : null };
    }
  }
}

export const TopResultCard = memo(function TopResultCard({ top, onPlay, onWarm }: TopResultCardProps) {
  const { t } = useTranslation("music");
  const headingId = useId();
  const face = useFace(top);
  const albumTarget = top.kind === "album" && !top.album.jellyfinId ? entityTarget(top.album) : null;
  // Le nom : un lien vers sa vue, dont la zone couvre toute la carte (le bouton Lecture reste au-dessus).
  const nameClass =
    "block truncate text-[28px] font-bold leading-tight tracking-tight text-content-primary focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-line-focus";
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <h2 id={headingId} className="px-2 text-xl font-bold tracking-tight text-content-primary">
        {t("search.topResult")}
      </h2>
      <div className="octave-card group relative flex min-h-[15rem] flex-1 flex-col justify-end gap-4 rounded-xl bg-fill-subtle p-5 transition-colors duration-150 hover:bg-fill-medium focus-within:bg-fill-medium">
        <Artwork url={face.art} kind={face.round ? "artist" : "album"} round={face.round} eager className="h-28 w-28 shadow-lg" />
        <div className="min-w-0 pr-16">
          {face.to ? (
            <Link to={face.to} className={nameClass} onClick={albumTarget && top.kind === "album" ? () => rememberAlbumPreview(albumTarget, top.album) : undefined}>
              {face.title}
            </Link>
          ) : (
            <button type="button" className={`${nameClass} w-full cursor-pointer text-left`} onClick={() => onPlay(top)} onPointerEnter={() => onWarm(top, "hover")} onPointerDown={() => onWarm(top, "press")}>
              {face.title}
            </button>
          )}
          <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-content-tertiary">
            <span className="shrink-0 rounded-full bg-fill-medium px-2.5 py-0.5 text-xs font-semibold text-content-secondary">{face.kind}</span>
            {face.subtitle && <span className="truncate">{face.subtitle}</span>}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("search.playTop", { title: face.title })}
          onPointerEnter={() => onWarm(top, "hover")}
          onPointerDown={() => onWarm(top, "press")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPlay(top);
          }}
          className="octave-card-play octave-brand-fill absolute bottom-5 right-5 z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
        >
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </button>
      </div>
    </section>
  );
});
