/**
 * Carte HORIZONTALE (16:9) d'un épisode téléchargé. L'affiche locale d'un
 * épisode (`primary.jpg`) EST sa vignette 16:9 : la rogner en 2:3, comme le
 * faisait le catalogue, rendait mal.
 *
 * Deux gestes distincts, comme sur les cartes en ligne : la carte ouvre la
 * fiche, le bouton superposé lance la lecture.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { DownloadEntry } from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";

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
  const { t } = useTranslation("downloads");
  const rootReady = useDownloadsRootReady();
  const [failed, setFailed] = useState(false);
  const url = rootReady ? localResourceUrl(`meta/${entry.itemId}/primary.jpg`) : null;

  const title = entry.title ?? entry.itemId;
  // Numéros absents (rattrapage en attente) : pas de « S00E00 » inventé.
  const code = entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const runtime = formatDuration(entry.runtimeTicks ?? undefined);

  return (
    <div
      className="group/card relative cursor-pointer"
      onClick={() => onSelect(entry)}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line-subtle transition-transform duration-200 group-hover/card:scale-[1.02]">
        {url && !failed ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-content-quaternary">
            {title}
          </div>
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
      </div>

      {runtime && <p className="mt-1 px-0.5 text-[11px] text-content-quaternary">{runtime}</p>}
    </div>
  );
});
