import { memo } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkMinus, Check, Loader2, Play } from "lucide-react";
import { useJellyfinClient, useToggleWatchlistForItem, watchStage } from "@tentacle-tv/api-client";
import { formatDuration, type MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "../MediaContextMenu";
import { useCardContextMenu } from "../cards/useCardContextMenu";
import { WatchProgressLine } from "./WatchProgressLine";

interface WatchlistRowProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  playPending: boolean;
  onRemoved: (item: MediaItem) => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

/**
 * Une ligne de la vue liste de Ma liste : affiche, titre, métadonnées, où l'on
 * en est, et les deux gestes de la page — Lire et Retirer — TOUJOURS visibles.
 * Sur la grille, ces gestes n'apparaissent qu'au survol ; la liste est la vue
 * du tactile et du clavier.
 *
 * Toute la ligne ouvre la fiche : un bouton étiré sous le contenu, et les
 * actions posées au-dessus. Pas de boutons imbriqués dans un bouton.
 *
 * Le survol est un calque en fondu d'OPACITÉ, pas une couleur de fond animée
 * (CLAUDE.md, coût GPU, règle 3).
 */
export const WatchlistRow = memo(function WatchlistRow({
  item, onOpen, onPlay, playPending, onRemoved, selecting, selected, onToggleSelect,
}: WatchlistRowProps) {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const client = useJellyfinClient();
  const { remove } = useToggleWatchlistForItem(item);
  // Le clic droit des cartes de la grille, repris tel quel : la vue liste ne
  // doit rien retirer de ce que la grille offre.
  const ctx = useCardContextMenu();
  const poster = client.getImageUrl(item.Id, "Primary", { height: 240, quality: 85 });
  const stage = watchStage(item);

  const meta = [
    item.ProductionYear ? String(item.ProductionYear) : null,
    item.Type === "Movie" ? tc("movie") : tc("series"),
    item.Type === "Movie" ? formatDuration(item.RunTimeTicks) : null,
    (item.Genres ?? []).slice(0, 2).join(", ") || null,
  ].filter(Boolean);

  // Annoncé AU GESTE, pas au succès : le retrait est optimiste, la ligne se
  // démonte aussitôt — et React Query ne rappelle pas le `onSuccess` d'un
  // `mutate` dont l'observateur a disparu. En cas d'échec, le cache se
  // restaure et « Annuler » ne fait que confirmer la présence du titre.
  const handleRemove = () => {
    remove.mutate();
    onRemoved(item);
  };

  return (
    <div
      className={`group/row relative flex items-center gap-3 rounded-2xl border p-2.5 sm:gap-4 sm:p-3 ${
        selected ? "border-[rgba(var(--brand-rgb),0.55)] bg-[rgba(var(--brand-rgb),0.08)]" : "border-line-subtle bg-surface-1"
      }`}
      {...(selecting ? {} : ctx.contextHandlers)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-fill-faint opacity-0 transition-opacity duration-150 group-hover/row:opacity-100"
      />
      <button
        type="button"
        onClick={() => {
          if (selecting) onToggleSelect(item.Id);
          else if (!ctx.ctxMenu) onOpen(item);
        }}
        aria-label={selecting ? item.Name : `${item.Name} — ${t("openDetail")}`}
        aria-pressed={selecting ? selected : undefined}
        className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      />

      {selecting && (
        <span
          aria-hidden
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-transparent bg-[var(--brand)] text-white" : "border-line-strong"
          }`}
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
      )}

      <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-fill-subtle sm:w-16">
        <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
      </div>

      <div className="relative min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-content-primary">{item.Name}</h3>
        <p className="mt-0.5 truncate text-xs text-content-quaternary">{meta.join(" · ")}</p>
        <div className="mt-2">
          <WatchProgressLine item={item} />
        </div>
      </div>

      {!selecting && (
        <div className="relative z-[2] flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onPlay(item)}
            disabled={playPending}
            aria-label={t("playTitle", { title: item.Name })}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-3 text-sm font-bold text-cta-primary-fg transition-transform duration-150 hover:scale-[1.04] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60 sm:px-4 motion-reduce:hover:scale-100"
          >
            {playPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} fill="currentColor" aria-hidden />}
            <span className="hidden sm:inline">{stage === "inProgress" ? t("resume") : t("play")}</span>
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={remove.isPending}
            aria-label={t("removeTitle", { title: item.Name })}
            title={t("remove")}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line-subtle bg-fill-subtle text-content-tertiary transition-colors duration-150 hover:border-status-error hover:text-status-error-fg disabled:opacity-50"
          >
            <BookmarkMinus size={17} aria-hidden />
          </button>
        </div>
      )}

      {!selecting && ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
        />
      )}
    </div>
  );
});
