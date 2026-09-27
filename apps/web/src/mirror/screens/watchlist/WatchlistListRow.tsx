import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Play, Trash2 } from "lucide-react";
import { useJellyfinClient, useToggleWatchlistForItem, watchProgress, watchStage } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useRemainingLabel } from "../../../components/watchlist/WatchProgressLine";
import { Pressable } from "../../ui/Pressable";
import { ProgressBar } from "../../ui/ProgressBar";

/**
 * Une ligne de la vue liste : affiche 56 × 84, titre 15 semi-gras, méta 12,
 * progression en barre ET en mots ; à droite, Lire (rond plein de 44) et
 * Retirer (rond de 44). Toucher la ligne ouvre la fiche — ou coche, en
 * sélection ; l'appui long ouvre la feuille d'actions.
 */
export const WatchlistListRow = memo(function WatchlistListRow({
  item, selecting, selected, pendingPlay, onPress, onLongPress, onPlay, onRemoved,
}: {
  item: MediaItem;
  selecting: boolean;
  selected: boolean;
  pendingPlay: boolean;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onRemoved: (item: MediaItem) => void;
}) {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const client = useJellyfinClient();
  const remainingLabel = useRemainingLabel();
  const { remove } = useToggleWatchlistForItem(item);
  const stage = watchStage(item);
  const percent = watchProgress(item);
  const meta = [item.ProductionYear, item.Type === "Movie" ? tc("movie") : tc("series")].filter(Boolean).join(" · ");
  const progressText =
    stage === "watched"
      ? t("finished")
      : stage === "new"
        ? t("notStarted")
        : [percent != null ? t("progressPercent", { percent: Math.round(percent) }) : null, remainingLabel(item)]
            .filter(Boolean)
            .join(" · ");

  // Retrait annoncé au geste : la ligne se démonte aussitôt (optimiste).
  const handleRemove = () => {
    remove.mutate();
    onRemoved(item);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-2 ${
        selected ? "border-[rgba(var(--brand-rgb),0.6)] bg-[rgba(var(--brand-rgb),0.1)]" : "border-line-subtle bg-surface-1"
      }`}
    >
      <Pressable
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        aria-label={item.Name}
        aria-pressed={selecting ? selected : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <img
            src={client.getImageUrl(item.Id, "Primary", { width: 120, quality: 80 })}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
          {selecting && (
            <span
              aria-hidden
              className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                selected ? "border-transparent bg-[var(--brand)] text-white" : "border-white/70 bg-black/40"
              }`}
            >
              {selected && <Check size={12} strokeWidth={3} />}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-content-primary">{item.Name}</p>
          <p className="mt-0.5 truncate text-xs text-content-quaternary">{meta}</p>
          {percent != null && stage !== "new" && <ProgressBar progress={percent / 100} className="mt-2 w-full max-w-[180px]" />}
          <p className={`mt-1 truncate text-[11px] font-medium ${stage === "watched" ? "text-status-success-fg" : "text-content-tertiary"}`}>
            {progressText}
          </p>
        </div>
      </Pressable>

      {!selecting && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onPlay(item)}
            disabled={pendingPlay}
            aria-label={t("playTitle", { title: item.Name })}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
          >
            {pendingPlay ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={t("removeTitle", { title: item.Name })}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-subtle bg-fill-subtle text-content-tertiary"
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
});
