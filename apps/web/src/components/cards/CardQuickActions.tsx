import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useToggleWatchlist, useFavorite, useAppConfig, useWatchedToggle } from "@tentacle-tv/api-client";
import { SharedWatchlistPicker } from "../SharedWatchlistPicker";

interface CardQuickActionsProps {
  itemId: string;
  initialFavorite: boolean;
  initialWatchlist: boolean;
  initialWatched?: boolean;
  /** Visual variant — `compact` is the always-on top-right cluster on the card image,
   *  `inline` is the bigger row inside the hover preview panel. */
  variant?: "compact" | "inline";
}

/**
 * Favorite / Watchlist / Watched / Shared-watchlist toggles with optimistic state.
 * Reused by both card variants (poster / episode) and the hover preview panel.
 */
export function CardQuickActions({
  itemId,
  initialFavorite,
  initialWatchlist,
  initialWatched = false,
  variant = "compact",
}: CardQuickActionsProps) {
  const { data: config } = useAppConfig();
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(itemId);
  const { add: addFav, remove: removeFav } = useFavorite(itemId);
  const { markWatched, markUnwatched } = useWatchedToggle(itemId);
  const [fav, setFav] = useState(initialFavorite);
  const [list, setList] = useState(initialWatchlist);
  const [watched, setWatched] = useState(initialWatched);
  const [sharedOpen, setSharedOpen] = useState<{ x: number; y: number } | null>(null);
  const [sharedAdded, setSharedAdded] = useState(false);

  useEffect(() => setFav(initialFavorite), [initialFavorite]);
  useEffect(() => setList(initialWatchlist), [initialWatchlist]);
  useEffect(() => setWatched(initialWatched), [initialWatched]);

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  const toggleFav = (e: React.MouseEvent) => {
    stop(e);
    setFav(!fav);
    if (fav) removeFav.mutate(); else addFav.mutate();
  };

  const toggleList = (e: React.MouseEvent) => {
    stop(e);
    setList(!list);
    if (list) removeWatchlist.mutate(); else addWatchlist.mutate();
  };

  const toggleWatched = (e: React.MouseEvent) => {
    stop(e);
    setWatched(!watched);
    if (watched) markUnwatched.mutate(); else markWatched.mutate();
  };

  const openShared = (e: React.MouseEvent) => {
    stop(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSharedOpen({
      x: Math.min(rect.right + 8, window.innerWidth - 280),
      y: rect.top,
    });
  };

  const sizeClass = variant === "compact" ? "h-7 w-7" : "h-9 w-9";
  const iconSize = variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";
  const dir = variant === "compact" ? "flex-col" : "flex-row";

  return (
    <>
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
        {config?.features.sharedWatchlists && (
          <button
            type="button"
            onClick={openShared}
            aria-label="Ajouter à une liste partagée"
            title="Ajouter à une liste partagée"
            className={`${sizeClass} flex items-center justify-center rounded-full border border-white/40 bg-black/55 text-white transition hover:scale-105 hover:border-white hover:bg-black/70 ${sharedAdded ? "border-[var(--brand-accent)] text-[var(--brand-accent)]" : ""}`}
          >
            <UsersIcon className={iconSize} />
          </button>
        )}
      </div>

      {sharedOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setSharedOpen(null)} />
          <div
            className="fixed z-[70] w-[260px] overflow-hidden rounded-xl border border-white/10 bg-surface-2/95 shadow-2xl backdrop-blur-lg"
            style={{ left: sharedOpen.x, top: sharedOpen.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <SharedWatchlistPicker
              itemId={itemId}
              onDone={() => setSharedOpen(null)}
              onSuccess={() => setSharedAdded(true)}
            />
          </div>
        </>,
        document.body,
      )}
    </>
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
function UsersIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
}
function EyeIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function EyeFilledIcon({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 4.5C7.36 4.5 3.423 7.51 2.036 11.683a1.012 1.012 0 000 .639C3.423 16.49 7.36 19.5 12 19.5c4.638 0 8.573-3.007 9.963-7.178a1.011 1.011 0 000-.639C20.577 7.51 16.64 4.5 12 4.5zM12 9a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" /></svg>;
}
