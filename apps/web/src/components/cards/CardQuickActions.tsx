import {
  useToggleWatchlistForItem,
  useFavoriteForItem,
  useWatchedToggle,
  useWatchlistSeriesIds,
  useFavoriteSeriesIds,
  seriesStateId,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * • `compact` — colonne d'angle sur l'affiche (la plus discrète).
 * • `bar`     — rangée horizontale de la barre d'actions révélée au survol.
 * • `inline`  — rangée pleine taille du panneau d'aperçu et de la bannière.
 */
type QuickActionsVariant = "compact" | "bar" | "inline";

const VARIANT_STYLE: Record<QuickActionsVariant, { box: string; icon: string; dir: string }> = {
  compact: { box: "h-7 w-7", icon: "h-3.5 w-3.5", dir: "flex-col" },
  bar: { box: "h-8 w-8", icon: "h-4 w-4", dir: "flex-row" },
  inline: { box: "h-9 w-9", icon: "h-4 w-4", dir: "flex-row" },
};

interface CardQuickActionsProps {
  item: MediaItem;
  variant?: QuickActionsVariant;
}

/**
 * Favorite / Watchlist / Watched toggles with optimistic state.
 *
 * Ma liste & Favoris agissent au niveau SÉRIE : sur un épisode, l'action porte
 * sur la série parente, et l'état affiché dérive de l'appartenance de la série
 * (Sets `watchlist-series-ids` / `favorite-series-ids`). Pour Movie/Series, on
 * lit directement `item.UserData`. Tout est piloté par le cache → mises à jour
 * optimistes instantanées sans état local.
 */
export function CardQuickActions({ item, variant = "compact" }: CardQuickActionsProps) {
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);
  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id, {
    seriesId: item.SeriesId,
    seasonId: item.SeasonId,
    itemType: item.Type,
  });
  const watchlistSeries = useWatchlistSeriesIds();
  const favoriteSeries = useFavoriteSeriesIds();

  // Épisode ET série lisent le Set (cf. `seriesStateId`) : une vignette « +N »
  // des derniers ajouts est fabriquée côté client et ne porte pas le `UserData`
  // de sa série — Ma liste n'y devenait jamais visible.
  const seriesId = seriesStateId(item);
  const list = seriesId ? watchlistSeries.has(seriesId) : item.UserData?.Likes === true;
  const fav = seriesId ? favoriteSeries.has(seriesId) : item.UserData?.IsFavorite === true;
  const watched = item.UserData?.Played === true;

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  const toggleFav = (e: React.MouseEvent) => {
    stop(e);
    if (fav) removeFav.mutate(); else addFav.mutate();
  };

  const toggleList = (e: React.MouseEvent) => {
    stop(e);
    if (list) removeWatchlist.mutate(); else addWatchlist.mutate();
  };

  const toggleWatched = (e: React.MouseEvent) => {
    stop(e);
    if (watched) markUnwatched.mutate(); else markWatched.mutate();
  };

  const { box: sizeClass, icon: iconSize, dir } = VARIANT_STYLE[variant];

  // Cluster de boutons posé directement sur l'affiche/la vignette (badges
  // d'angle) : fond noir translucide + icônes blanches volontairement
  // constants dans les deux thèmes (cf. règle « posé sur média »).
  return (
    <div className={`flex ${dir} gap-1.5`}>
      <button
        type="button"
        onClick={toggleWatched}
        aria-label={watched ? "Marquer comme non vu" : "Marquer comme vu"}
        title={watched ? "Marquer comme non vu" : "Marquer comme vu"}
        className={`${sizeClass} flex items-center justify-center rounded-full border bg-black/55 transition hover:scale-105 hover:bg-black/70 ${
          watched
            ? "border-emerald-400/80 text-emerald-300"
            : "border-white/40 text-white hover:border-white"
        }`}
      >
        {watched ? <EyeFilledIcon className={iconSize} /> : <EyeIcon className={iconSize} />}
      </button>
      <button
        type="button"
        onClick={toggleFav}
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={`${sizeClass} flex items-center justify-center rounded-full border border-white/40 bg-black/55 text-white transition hover:scale-105 hover:border-white hover:bg-black/70`}
      >
        {fav ? <HeartFilled className={iconSize} /> : <HeartOutline className={iconSize} />}
      </button>
      <button
        type="button"
        onClick={toggleList}
        aria-label={list ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
        title={list ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
        className={`${sizeClass} flex items-center justify-center rounded-full border border-white/40 bg-black/55 text-white transition hover:scale-105 hover:border-white hover:bg-black/70`}
      >
        {list ? <CheckIcon className={iconSize} /> : <PlusIcon className={iconSize} />}
      </button>
    </div>
  );
}

function HeartFilled({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004z" /></svg>;
}
function HeartOutline({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>;
}
function CheckIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
}
function PlusIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
}
function EyeIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function EyeFilledIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 4.5C7.36 4.5 3.423 7.51 2.036 11.683a1.012 1.012 0 000 .639C3.423 16.49 7.36 19.5 12 19.5c4.638 0 8.573-3.007 9.963-7.178a1.011 1.011 0 000-.639C20.577 7.51 16.64 4.5 12 4.5zM12 9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" /></svg>;
}
