/**
 * Carte HORIZONTALE (16:9) d'un épisode téléchargé. L'affiche locale d'un
 * épisode (`primary.jpg`) EST sa vignette 16:9 : la rogner en 2:3, comme le
 * faisait le catalogue, rendait mal.
 *
 * Deux gestes distincts, comme sur les cartes en ligne : la carte ouvre la
 * fiche, le bouton superposé lance la lecture.
 */

import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import { CardProgressBar } from "../components/cards/CardProgressBar";
import { CardTrickplayImage } from "../components/cards/CardTrickplayImage";
import { CardWatchedBadge } from "../components/cards/CardWatchedBadge";
import { useLocalTrickplay } from "../hooks/useLocalTrickplay";
import { resolveResumeSprite } from "../hooks/useResumeFrame";
import type { DownloadEntry } from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { watchStateOf } from "./offlineGroups";

interface OfflineEpisodeCardProps {
  entry: DownloadEntry;
  onSelect: (entry: DownloadEntry) => void;
  onPlay: (entry: DownloadEntry) => void;
}

export const OfflineEpisodeCard = memo(function OfflineEpisodeCard({
  entry,
  onSelect,
  onPlay,
}: OfflineEpisodeCardProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const rootReady = useDownloadsRootReady();
  const [failed, setFailed] = useState(false);
  const { watched, percent } = watchStateOf(entry);
  const url = rootReady ? localResourceUrl(`meta/${entry.itemId}/primary.jpg`) : null;

  // La vignette EXACTE de la reprise, croppée dans les planches DÉJÀ
  // téléchargées — zéro réseau. Le manifeste local n'est lu que pour un
  // épisode entamé : les autres cartes gardent leur affiche sans requête.
  const local = useLocalTrickplay(entry.positionTicks > 0 ? entry.itemId : undefined);
  const sprite = useMemo(
    () => (local && !watched ? resolveResumeSprite(local.manifest, entry.positionTicks) : null),
    [local, watched, entry.positionTicks],
  );
  const frameUrl = sprite && local ? local.buildTileUrl(sprite.tileIndex) : null;
  const frame =
    sprite && frameUrl
      ? { url: frameUrl, info: sprite.selection.info, col: sprite.col, row: sprite.row }
      : null;

  const title = entry.title ?? entry.itemId;
  // Numéros absents (rattrapage en attente) : pas de « S00E00 » inventé.
  const code = entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const runtime = formatDuration(entry.runtimeTicks ?? undefined);

  const banner = url && !failed ? (
    <img
      src={url}
      alt=""
      loading="lazy" decoding="async"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-content-quaternary">
      {title}
    </div>
  );

  return (
    <div
      className="group/card relative cursor-pointer"
      onClick={() => onSelect(entry)}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line-subtle transition-transform duration-200 group-hover/card:scale-[1.02]">
        {frame ? (
          // Le conteneur porte déjà son propre scale au survol : pas de second
          // zoom interne. L'affiche reste le repli si la planche ne charge pas.
          <CardTrickplayImage frame={frame} alt={title} zoom={false} fallback={banner} />
        ) : (
          banner
        )}

        {/* Scrim + textes posés SUR la vignette : blanc/noir constants dans les
            deux thèmes (règle « posé sur média »). */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-1.5 pl-3 pr-14 text-white">
          {code && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{code}</p>
          )}
          <p className="line-clamp-1 text-xs font-semibold">{title}</p>
        </div>

        <button
          type="button"
          aria-label={t("downloads:episodePlay")}
          title={t("downloads:episodePlay")}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(entry);
          }}
          className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black opacity-0 transition-opacity duration-150 hover:bg-white group-hover/card:opacity-100 focus-visible:opacity-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>

        {/* Coche OU barre, jamais les deux — même règle qu'en ligne. La barre
            porte sa bordure : elle est posée sur un scrim déjà sombre. */}
        {watched
          ? <CardWatchedBadge label={t("common:watched")} />
          : <CardProgressBar percent={percent} border />}
      </div>

      {runtime && <p className="mt-1 px-0.5 text-[11px] text-content-quaternary">{runtime}</p>}
    </div>
  );
});
