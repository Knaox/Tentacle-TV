import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play } from "lucide-react";
import { useJellyfinClient, watchProgress } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useRemainingLabel } from "./WatchProgressLine";

interface WatchlistResumeShelfProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  pendingPlayId: string | null;
}

/**
 * « Reprendre » — les titres commencés de la liste, le dernier regardé en tête.
 * Toucher une vignette LANCE la lecture : c'est la seule promesse de cette
 * rangée. La fiche reste à un clic dans la grille, juste en dessous.
 *
 * Vignettes 16:9 sur l'image de fond du titre — l'affiche 2:3 est déjà celle
 * de la grille, et deux fois la même image à l'écran ne dit rien de plus.
 */
export const WatchlistResumeShelf = memo(function WatchlistResumeShelf({
  items, onPlay, pendingPlayId,
}: WatchlistResumeShelfProps) {
  const { t } = useTranslation("watchlist");
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="watchlist-resume-title" className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id="watchlist-resume-title" className="text-lg font-bold tracking-tight text-content-primary">
          {t("resumeTitle")}
        </h2>
        <span className="text-xs text-content-quaternary">{t("resumeHint")}</span>
      </div>
      <ul className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
        {items.map((item) => (
          <li key={item.Id} className="snap-start">
            <ResumeTile item={item} onPlay={onPlay} pending={pendingPlayId === item.Id} />
          </li>
        ))}
      </ul>
    </section>
  );
});

const ResumeTile = memo(function ResumeTile({
  item, onPlay, pending,
}: {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  pending: boolean;
}) {
  const { t } = useTranslation("watchlist");
  const client = useJellyfinClient();
  const remainingLabel = useRemainingLabel();
  const hasBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
  const image = hasBackdrop
    ? client.getImageUrl(item.Id, "Backdrop", { width: 640, quality: 80 })
    : client.getImageUrl(item.Id, "Primary", { width: 640, quality: 80 });
  const percent = watchProgress(item);
  const remaining = remainingLabel(item);

  return (
    <button
      type="button"
      onClick={() => onPlay(item)}
      disabled={pending}
      aria-label={`${t("resume")} — ${item.Name}${remaining ? `, ${remaining}` : ""}`}
      className="group/tile relative block aspect-video w-[240px] cursor-pointer overflow-hidden rounded-xl bg-fill-subtle text-left ring-1 ring-line-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-wait sm:w-[300px]"
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover/tile:scale-[1.04] motion-reduce:!transform-none"
      />
      {/* Voile constant dans les deux thèmes : le texte est posé sur l'image. */}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      <span
        aria-hidden
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform duration-150 group-hover/tile:scale-110 motion-reduce:!transform-none"
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </span>

      <span className="absolute inset-x-3 bottom-3 block">
        <span className="block truncate text-sm font-semibold text-white drop-shadow">{item.Name}</span>
        {remaining && <span className="mt-0.5 block text-xs text-white/75">{remaining}</span>}
      </span>
      {percent != null && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-black/55">
          <span className="block h-full" style={{ width: `${percent}%`, background: "var(--progress-fill)" }} />
        </span>
      )}
    </button>
  );
});
