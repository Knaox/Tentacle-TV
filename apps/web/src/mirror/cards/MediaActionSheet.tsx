import { useTranslation } from "react-i18next";
import { Check, CheckCircle, Heart, Plus, type LucideIcon } from "lucide-react";
import { useFavorite, useJellyfinClient, useMediaItem, useToggleWatchlist, useWatchedToggle } from "@tentacle-tv/api-client";
import { ActionSheet } from "../ui/ActionSheet";

/**
 * La feuille de l'appui long sur une affiche (`MediaActionSheet` de l'app) :
 * bandeau de 96 (visuel voilé, affiche 52×76, titre, année · type), puis les
 * actions rondes — Favori, Ma liste, Vu. Favoris et Ma liste visent la SÉRIE
 * d'un épisode ; « Vu » vise le titre appuyé. « Garder hors ligne » n'existe
 * pas dans un navigateur : la cellule manque, comme dans l'app hors bibliothèque.
 */
export function MediaActionSheet({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const open = itemId !== null;
  const { data: item } = useMediaItem(itemId ?? undefined);
  const isEpisode = item?.Type === "Episode";
  const targetId = isEpisode ? (item?.SeriesId ?? itemId ?? "") : (itemId ?? "");
  const { data: parent } = useMediaItem(open && isEpisode ? item?.SeriesId : undefined);
  const target = isEpisode ? parent : item;
  const display = target ?? item;

  const favorite = useFavorite(targetId);
  const watchlist = useToggleWatchlist(targetId);
  const watched = useWatchedToggle(itemId ?? "", {
    seriesId: item?.SeriesId,
    seasonId: item?.SeasonId ?? undefined,
    itemType: item?.Type,
  });

  const isFav = target?.UserData?.IsFavorite === true;
  const inList = target?.UserData?.Likes === true;
  const isWatched = item?.UserData?.Played === true;

  return (
    <ActionSheet open={open} onClose={onClose} label={display?.Name}>
      {display && (
        <div className="relative mx-4 mb-4 mt-2 h-24 overflow-hidden rounded-xl border border-line-subtle">
          <img
            src={client.getImageUrl(display.Id, "Backdrop", { width: 600, quality: 70 })}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <div className="absolute inset-0 bg-glass-tint-strong" />
          <div className="relative flex h-full items-center gap-3 p-3">
            <div className="relative h-[76px] w-[52px] shrink-0 overflow-hidden rounded-md bg-surface-2" style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}>
              <img src={client.getImageUrl(display.Id, "Primary", { width: 240, quality: 85 })} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-[3px] line-clamp-2 text-base font-bold tracking-[-0.2px] text-content-primary">{display.Name}</p>
              <p className="truncate text-[13px] font-medium tracking-[0.2px] text-brand-light">
                {display.ProductionYear ?? ""}
                {display.ProductionYear && display.Type ? " · " : ""}
                {display.Type === "Series" ? t("series") : display.Type === "Movie" ? t("movie") : display.Type}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-2.5 px-4 pb-3">
        <ActionCell
          Icon={Heart}
          label={isFav ? t("inFavorites") : t("addToFavorites")}
          active={isFav}
          color="var(--status-error)"
          rgb="239, 68, 68"
          fill
          onPress={() => (isFav ? favorite.remove.mutate() : favorite.add.mutate())}
        />
        <ActionCell
          Icon={inList ? Check : Plus}
          label={inList ? t("inMyList") : t("addToMyList")}
          active={inList}
          color="var(--brand)"
          onPress={() => (inList ? watchlist.remove.mutate() : watchlist.add.mutate())}
        />
        <ActionCell
          Icon={CheckCircle}
          label={isWatched ? t("markUnwatched") : t("markWatched")}
          active={isWatched}
          color="var(--brand)"
          onPress={() => (isWatched ? watched.markUnwatched.mutate() : watched.markWatched.mutate())}
        />
      </div>
    </ActionSheet>
  );
}

/** La cellule ronde (`ActionCell` de l'app) : anneau 60, icône 26, libellé 12,5. */
export function ActionCell({ Icon, label, active, color, rgb, fill = false, onPress }: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  color: string;
  /** Composantes RVB de la couleur active, pour ses teintes ; la marque par défaut. */
  rgb?: string;
  fill?: boolean;
  onPress: () => void;
}) {
  const tint = rgb ? `rgba(${rgb}, 0.13)` : "rgba(var(--brand-rgb), 0.13)";
  const ring = rgb ? `rgba(${rgb}, 0.33)` : "rgba(var(--brand-rgb), 0.33)";
  return (
    <button
      type="button"
      onClick={() => {
        try {
          navigator.vibrate?.(10);
        } catch {
          /* pas de vibreur */
        }
        onPress();
      }}
      aria-pressed={active}
      className="flex flex-1 flex-col items-center rounded-xl bg-fill-faint px-2.5 py-4 active:opacity-75"
    >
      <span
        className="mb-2.5 flex h-[60px] w-[60px] items-center justify-center rounded-full border"
        style={{ background: active ? tint : "var(--fill-subtle)", borderColor: active ? ring : "var(--border-subtle)" }}
      >
        <Icon size={26} color={active ? color : "var(--text-primary)"} fill={fill && active ? color : "none"} aria-hidden />
      </span>
      <span
        className="line-clamp-2 text-center text-[12.5px] font-semibold leading-[15px] tracking-[0.1px]"
        style={{ color: active ? color : "var(--text-secondary)" }}
      >
        {label}
      </span>
    </button>
  );
}
