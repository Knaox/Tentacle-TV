import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { HorizontalScrollRow } from "../HorizontalScrollRow";

interface EpisodeSelectorPanelProps {
  seriesId: string;
  currentEpisodeId: string;
  currentSeasonId?: string;
  onClose: () => void;
}

/**
 * Panneau « Épisodes » intégré au lecteur (style Netflix) : onglets de saisons +
 * liste d'épisodes scrollable. Cliquer un épisode lance sa lecture (remplace
 * l'entrée /watch courante). Réutilise le pattern glass du TrackSelector et les
 * chips actifs du thème (brand-soft / brand-light).
 */
export function EpisodeSelectorPanel({
  seriesId,
  currentEpisodeId,
  currentSeasonId,
  onClose,
}: EpisodeSelectorPanelProps) {
  const { t } = useTranslation("player");
  const navigate = useNavigate();
  const { data: seasons } = useSeasons(seriesId);
  const [seasonId, setSeasonId] = useState<string | undefined>(currentSeasonId);
  const effectiveSeasonId = seasonId ?? currentSeasonId ?? seasons?.[0]?.Id;
  const { data: episodes } = useEpisodes(seriesId, effectiveSeasonId);

  const select = (id: string) => {
    if (id !== currentEpisodeId) navigate(`/watch/${id}`, { replace: true });
    onClose();
  };

  return (
    // Panneau DÉTACHÉ (même traitement que TrackSelector) : fond quasi-opaque
    // `surface-dropdown`, suit le thème clair/sombre — pas posé sur la vidéo.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 flex max-h-[65vh] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <span className="text-sm font-semibold text-content-primary">{t("player:episodes")}</span>
        <button onClick={onClose} aria-label={t("player:close")} className="text-lg leading-none text-content-quaternary transition-colors hover:text-content-primary">
          &times;
        </button>
      </div>

      {seasons && seasons.length > 1 && (
        <HorizontalScrollRow
          wrapperClassName="border-b border-line-subtle"
          className="items-center gap-2 px-4 py-2"
          ariaLabel={t("player:episodes")}
        >
          {seasons.map((s) => (
            <button
              key={s.Id}
              onClick={() => setSeasonId(s.Id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors ${
                s.Id === effectiveSeasonId
                  ? "border-[var(--brand)]/45 bg-[var(--brand-soft)] text-[var(--brand-light)]"
                  : "border-line-subtle bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
              }`}
            >
              {s.Name}
            </button>
          ))}
        </HorizontalScrollRow>
      )}

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {episodes?.map((ep) => (
          <EpisodeItem
            key={ep.Id}
            ep={ep}
            active={ep.Id === currentEpisodeId}
            onClick={() => select(ep.Id)}
          />
        ))}
        {(!episodes || episodes.length === 0) && (
          <p className="px-3 py-8 text-center text-sm text-content-quaternary">{t("player:noEpisodes")}</p>
        )}
      </div>
    </motion.div>
  );
}

function EpisodeItem({ ep, active, onClick }: { ep: MediaItem; active: boolean; onClick: () => void }) {
  const client = useJellyfinClient();
  const thumb = client.getImageUrl(ep.Id, "Primary", { width: 240, quality: 80 });
  const watched = ep.UserData?.Played === true;
  const progress = ep.UserData?.PlayedPercentage;
  const runtime = formatDuration(ep.RunTimeTicks);
  const epLabel = formatEpisodeCode(ep.ParentIndexNumber, ep.IndexNumber, { style: "padded" });

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
        active ? "bg-[var(--brand-soft)]" : "hover:bg-fill-subtle"
      }`}
    >
      {/* Vignette = image média : badge « vu » et barre de progression restent
          en dur (posés sur une miniature, comme les cartes média ailleurs). */}
      <div className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-md bg-surface-2">
        <img src={thumb} alt={ep.Name} loading="lazy" className="h-full w-full object-cover" />
        {watched && (
          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
            <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </div>
        )}
        {!watched && progress != null && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div className="h-full" style={{ width: `${progress}%`, background: "var(--progress-fill)" }} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-bold uppercase tracking-wider ${active ? "text-[var(--brand-light)]" : "text-content-quaternary"}`}>
          {epLabel}
        </p>
        <p className="line-clamp-1 text-sm font-medium text-content-primary">{ep.Name}</p>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>
    </button>
  );
}
