/**
 * Carte HORIZONTALE (16:9) d'un titre gardé : les épisodes d'une saison, et
 * les rangées « Reprendre » et « À suivre » de l'accueil local.
 *
 * La grammaire des vignettes en ligne (`EpisodeCard`) : le clic LANCE la
 * lecture, la fiche passe par le plateau du survol (variante `landscape`, en
 * mode LOCAL : la coche « vu » seule, ni note ni requête). L'image est
 * l'EXACTE image de la reprise pour un titre entamé, tirée des planches
 * trickplay déjà sur le disque ; sinon la vignette de l'épisode, ou le décor
 * d'un film — son affiche 2:3 se rognerait mal.
 */

import { memo, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode, resolveResumeSprite } from "@tentacle-tv/shared";
import { localMediaItem, watchStateOf } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "./api";
import { useLocalSnapshot } from "./useLocalSnapshot";
import { useDownloadsRootReady } from "./localFiles";
import { LocalCardImage } from "./LocalCardImage";
import { CardFrame } from "../components/cards/CardFrame";
import { CardHoverOverlay } from "../components/cards/CardHoverOverlay";
import { CardProgressBar } from "../components/cards/CardProgressBar";
import { CardRatingBadge } from "../components/cards/CardRatingBadge";
import { CardStatusMarkers } from "../components/cards/CardStatusMarkers";
import { CardTrickplayImage } from "../components/cards/CardTrickplayImage";
import { useLocalTrickplay } from "../hooks/useLocalTrickplay";
import { useMountWhile } from "../hooks/useMountWhile";
import type { MediaItem } from "@tentacle-tv/shared";

const EPISODE_ART = ["primary.jpg", "backdrop.jpg"] as const;
const MOVIE_ART = ["backdrop.jpg", "primary.jpg"] as const;
const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];

interface OfflineEpisodeCardProps {
  entry: DownloadEntry;
  /** Sous la vignette : le nom de la série ou du film (rangées de l'accueil), sinon la durée seule. */
  showHeading?: boolean;
  onPlay: (entry: DownloadEntry) => void;
  onOpen: (entry: DownloadEntry) => void;
  onToggleWatched: (entry: DownloadEntry) => void;
}

export const OfflineEpisodeCard = memo(function OfflineEpisodeCard({
  entry, showHeading = false, onPlay, onOpen, onToggleWatched,
}: OfflineEpisodeCardProps) {
  const { t } = useTranslation("common");
  const rootReady = useDownloadsRootReady();
  const [hovered, setHovered] = useState(false);
  const overlayMounted = useMountWhile(hovered, 200);
  const { watched, percent } = watchStateOf(entry);
  // Le snapshot de CE titre : sa note, et les puces qualité/langues du FICHIER.
  const snapshot = useLocalSnapshot<MediaItem>(entry.itemId, "item.json", rootReady);
  const item = useMemo(() => localMediaItem(snapshot, entry), [snapshot, entry]);

  // La planche n'est lue que pour un titre entamé : les autres gardent leur
  // vignette sans requête.
  const local = useLocalTrickplay(entry.positionTicks > 0 && !watched ? entry.itemId : undefined);
  const sprite = useMemo(
    () => (local ? resolveResumeSprite(local.manifest, entry.positionTicks) : null),
    [local, entry.positionTicks],
  );
  const frameUrl = sprite && local ? local.buildTileUrl(sprite.tileIndex) : null;

  const isEpisode = entry.kind === "episode";
  const title = entry.title ?? entry.itemId;
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const heading = isEpisode ? (entry.seriesName ?? title) : title;
  const runtime = formatDuration(entry.runtimeTicks ?? undefined);
  const art = isEpisode ? EPISODE_ART : MOVIE_ART;
  const image = <LocalCardImage itemId={entry.itemId} candidates={art} fallback={title} />;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPlay(entry);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${t("play")} — ${heading}${isEpisode ? ` · ${title}` : ""}`}
      className="group/card relative cursor-pointer rounded-[var(--radius-lg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      style={{ zIndex: hovered ? 2 : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
      onClick={() => onPlay(entry)}
      onKeyDown={onKeyDown}
    >
      <CardFrame hovered={hovered} aspect="aspect-video" lift={{ scale: 1.04, y: -7 }}>
        {sprite && frameUrl
          ? <CardTrickplayImage frame={{ url: frameUrl, info: sprite.selection.info, col: sprite.col, row: sprite.row }} alt={title} fallback={image} />
          : image}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: "var(--card-reveal-scrim)" }} />
        <CardRatingBadge rating={snapshot?.CommunityRating ?? null} shown={!hovered} className="left-2 top-2" />
        <CardStatusMarkers statuses={watched ? WATCHED : NONE} shown={!hovered} />
        <div className={`absolute inset-x-0 bottom-1.5 pl-3 text-on-media-primary ${hovered ? "pr-[7.5rem]" : "pr-4"}`}>
          {code && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-media-secondary">{code}</p>}
          <p className="line-clamp-1 text-xs font-semibold">{title}</p>
        </div>
        {overlayMounted && (
          <CardHoverOverlay
            variant="landscape"
            item={item}
            title={isEpisode ? `${heading} — ${title}` : title}
            visible={hovered}
            play={{
              resume: percent !== null && percent > 0,
              onPlay: (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                onPlay(entry);
              },
            }}
            meta={item}
            onOpenDetails={() => onOpen(entry)}
            local={{
              states: { watchlist: false, favorite: false, watched },
              onToggle: (kind) => {
                if (kind === "watched") onToggleWatched(entry);
              },
            }}
          />
        )}
        {!watched && <CardProgressBar percent={percent} border />}
      </CardFrame>
      <div className="mt-2.5 px-0.5">
        {showHeading && <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{heading}</h3>}
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>
    </div>
  );
});
