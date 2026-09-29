import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import { SeasonTabs, type SeasonTabItem } from "../episodes/SeasonTabs";
import { useDownloadsList } from "../../downloads/useDownloadState";
import { byEpisodeNumber } from "@tentacle-tv/offline-core";
import { localResourceUrl, useDownloadsRootReady } from "../../downloads/localFiles";
import type { DownloadEntry } from "../../downloads/api";

interface LocalEpisodeSelectorPanelProps {
  currentEpisodeId: string;
  onClose: () => void;
}

const LAST = Number.MAX_SAFE_INTEGER;

/** L'identifiant d'onglet d'une saison gardée (son numéro, ou « inconnue »). */
const seasonKey = (num: number | null | undefined) => (num != null ? `season-${num}` : "season-unknown");

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
  // Les saisons GARDÉES, sous la forme que lisent les pastilles : leur compteur
  // est celui des épisodes présents sur l'appareil.
  const tabs = useMemo<SeasonTabItem[]>(
    () =>
      seasonNumbers.map((num) => ({
        Id: seasonKey(num),
        Name: num != null ? t("downloads:seasonLabel", { num }) : t("downloads:seasonUnknown"),
        RecursiveItemCount: siblings.filter((e) => e.parentIndexNumber === num).length,
      })),
    [seasonNumbers, siblings, t],
  );
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
    // PAS de `backdrop-filter` : `surface-dropdown` est à 0,95 d'alpha, il ne
    // reste rien à flouter, alors que le panneau flotte au-dessus d'une vidéo
    // en lecture dont l'arrière-plan change à chaque image décodée. Même
    // arbitrage que son jumeau en ligne (`EpisodeSelectorPanel`).
    <motion.div data-panneau-detache
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 flex max-h-[65vh] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-line-subtle bg-[var(--surface-dropdown)]"
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
        <div className="border-b border-line-subtle px-2 py-2.5">
          <SeasonTabs
            seasons={tabs}
            selectedId={seasonKey(effectiveSeason)}
            markedId={seasonKey(currentSeason)}
            onSelect={(id) => setSelected(seasonNumbers.find((num) => seasonKey(num) === id) ?? null)}
            size="sm"
          />
        </div>
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
