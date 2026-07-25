import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import { HorizontalScrollRow } from "../HorizontalScrollRow";
import { useDownloadsList } from "../../downloads/useDownloadState";
import { byEpisodeNumber } from "../../downloads/offlineGroups";
import { localResourceUrl, useDownloadsRootReady } from "../../downloads/localFiles";
import type { DownloadEntry } from "../../downloads/api";

interface LocalEpisodeSelectorPanelProps {
  currentEpisodeId: string;
  onClose: () => void;
}

const LAST = Number.MAX_SAFE_INTEGER;

/**
 * Variante LOCALE du panneau « Épisodes » du lecteur : liste les épisodes
 * TÉLÉCHARGÉS de la série courante, groupés par saison, vignettes servies par
 * le loopback — zéro requête serveur, fonctionne hors ligne. Montée à la place
 * d'EpisodeSelectorPanel dès que la lecture est locale ou hors ligne (même
 * traitement visuel : panneau détaché surface-dropdown).
 */
export function LocalEpisodeSelectorPanel({ currentEpisodeId, onClose }: LocalEpisodeSelectorPanelProps) {
  const { t } = useTranslation(["player", "downloads"]);
  const navigate = useNavigate();
  const entries = useDownloadsList();

  // Épisodes complets de la même série que l'épisode courant, ordre SxxEyy.
  const siblings = useMemo(() => {
    const episodes = entries.filter((e) => e.status === "complete" && e.kind === "episode");
    const current = episodes.find((e) => e.itemId === currentEpisodeId);
    if (!current) return [];
    const sameSeries = (e: DownloadEntry) =>
      e.seriesId && current.seriesId
        ? e.seriesId === current.seriesId
        : (e.seriesName ?? "") === (current.seriesName ?? "");
    return episodes.filter(sameSeries).sort(byEpisodeNumber);
  }, [entries, currentEpisodeId]);

  const seasonNumbers = useMemo(
    () =>
      [...new Set(siblings.map((e) => e.parentIndexNumber))].sort(
        (a, b) => (a ?? LAST) - (b ?? LAST),
      ),
    [siblings],
  );
  const currentSeason = siblings.find((e) => e.itemId === currentEpisodeId)?.parentIndexNumber ?? null;
  const [selected, setSelected] = useState<number | null | undefined>(undefined);
  const effectiveSeason = selected !== undefined ? selected : currentSeason;
  const episodes = useMemo(
    () => siblings.filter((e) => e.parentIndexNumber === effectiveSeason),
    [siblings, effectiveSeason],
  );

  const select = (id: string) => {
    if (id !== currentEpisodeId) navigate(`/watch/${id}`, { replace: true });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 flex max-h-[65vh] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-content-primary">
          {t("player:episodes")}
          <span className="rounded-full bg-fill-subtle px-2 py-0.5 text-[10px] font-medium text-content-tertiary">
            {t("downloads:episodesDownloadedHint")}
          </span>
        </span>
        <button onClick={onClose} aria-label={t("player:close")} className="text-lg leading-none text-content-quaternary transition-colors hover:text-content-primary">
          &times;
        </button>
      </div>

      {seasonNumbers.length > 1 && (
        <HorizontalScrollRow
          wrapperClassName="border-b border-line-subtle"
          className="items-center gap-2 px-4 py-2"
          ariaLabel={t("player:episodes")}
        >
          {seasonNumbers.map((num) => (
            <button
              key={num ?? "unknown"}
              onClick={() => setSelected(num)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors ${
                num === effectiveSeason
                  ? "border-[var(--brand)]/45 bg-[var(--brand-soft)] text-[var(--brand-light)]"
                  : "border-line-subtle bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
              }`}
            >
              {num != null ? t("downloads:seasonLabel", { num }) : t("downloads:seasonUnknown")}
            </button>
          ))}
        </HorizontalScrollRow>
      )}

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {episodes.map((ep) => (
          <LocalEpisodeItem key={ep.itemId} ep={ep} active={ep.itemId === currentEpisodeId} onClick={() => select(ep.itemId)} />
        ))}
        {episodes.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-content-quaternary">{t("player:noEpisodes")}</p>
        )}
      </div>
    </motion.div>
  );
}

function LocalEpisodeItem({ ep, active, onClick }: { ep: DownloadEntry; active: boolean; onClick: () => void }) {
  const rootReady = useDownloadsRootReady();
  const thumb = rootReady ? localResourceUrl(`meta/${ep.itemId}/primary.jpg`) : null;
  const runtime = formatDuration(ep.runtimeTicks ?? undefined);
  const epLabel = formatEpisodeCode(ep.parentIndexNumber ?? undefined, ep.indexNumber ?? undefined, { style: "padded" });

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
        active ? "bg-[var(--brand-accent-soft)]" : "hover:bg-fill-subtle"
      }`}
    >
      <div className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-md bg-surface-2">
        {thumb && <img src={thumb} alt={ep.title ?? ""} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-bold uppercase tracking-wider ${active ? "text-[var(--brand-accent-light)]" : "text-content-quaternary"}`}>
          {epLabel}
        </p>
        <p className="line-clamp-1 text-sm font-medium text-content-primary">{ep.title ?? ""}</p>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>
    </button>
  );
}
