import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useToggleWatchlistForItem, useFavoriteForItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { CardMetaOverlay } from "./media/CardMetaOverlay";
import { CollectionCardBadges } from "./collection/CollectionCardBadges";
import { useHoverMount } from "../hooks/useHoverMount";

type FilterTab = "all" | "Movie" | "Series";

export interface SelectionMode {
  isSelecting: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
}

interface CollectionGridProps {
  title: string;
  items: MediaItem[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: ReactNode;
  actions?: ReactNode;
  selectionMode?: SelectionMode;
  onFilteredIdsChange?: (ids: string[]) => void;
}

export function CollectionGrid({
  title, items, isLoading, emptyMessage, emptyHint, emptyIcon, actions, selectionMode, onFilteredIdsChange,
}: CollectionGridProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = items?.filter((item) => filter === "all" || item.Type === filter);

  const filteredIdsRef = useRef<string[]>([]);
  const filteredIds = filtered?.map((i) => i.Id) ?? [];
  if (filteredIds.join(",") !== filteredIdsRef.current.join(",")) {
    filteredIdsRef.current = filteredIds;
  }
  useEffect(() => {
    onFilteredIdsChange?.(filteredIdsRef.current);
  }, [filteredIdsRef.current, onFilteredIdsChange]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("common:allFilter") },
    { key: "Movie", label: t("common:moviesFilter") },
    { key: "Series", label: t("common:seriesFilter") },
  ];

  return (
    <div className="px-4 pt-6 md:px-12">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-content-secondary transition-colors hover:bg-fill-soft"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-content-primary truncate">{title}</h1>
      </div>

      {/* Filter tabs + actions */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === tab.key
                ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.3)]"
                : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {actions && (
          <div className="ml-auto flex items-center gap-2 sm:ml-auto">{actions}</div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-fill-subtle" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          {emptyIcon && <div className="mb-4 text-5xl opacity-40">{emptyIcon}</div>}
          <p className="text-lg text-content-quaternary">{emptyMessage}</p>
          {emptyHint && <p className="mt-2 text-sm text-content-disabled">{emptyHint}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {filtered.map((item, i) => (
            <CollectionGridCard key={item.Id} item={item} index={i} selectionMode={selectionMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionGridCard({ item, index, selectionMode }: { item: MediaItem; index: number; selectionMode?: SelectionMode }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelecting = selectionMode?.isSelecting ?? false;
  const isSelected = selectionMode?.isSelected(item.Id) ?? false;

  // Survol en React, et non plus par `group-hover` seul. Chaque carte portait
  // en permanence CINQ couches floutées invisibles — deux badges d'angle en
  // `blur(4px)` et les pastilles méta en `backdrop-blur-md` — masquées par
  // `opacity: 0`, ce qui ne libère rien : la couche composée subsiste et son
  // arrière-plan est recopié puis refloué. Sur une liste de cent titres, avec
  // une quinzaine de cellules à l'écran, cela faisait près de quatre-vingts
  // flous entretenus pour des contrôles que personne ne voit.
  // 200 ms couvre les deux fondus (badges 150 ms, méta 200 ms) : le démontage
  // attend le plus lent, aucun des deux n'est coupé.
  const hover = useHoverMount(200);

  const [localFavorite, setLocalFavorite] = useState(item.UserData?.IsFavorite === true);
  const [localWatchlist, setLocalWatchlist] = useState(item.UserData?.Likes === true);
  useEffect(() => { setLocalFavorite(item.UserData?.IsFavorite === true); }, [item.UserData?.IsFavorite]);
  useEffect(() => { setLocalWatchlist(item.UserData?.Likes === true); }, [item.UserData?.Likes]);

  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);

  const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
  const progress = item.UserData?.PlayedPercentage;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => setCtxMenu(pos), 500);
  }, []);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  return (
    <div
      onClick={() => {
        if (isSelecting) { selectionMode?.toggle(item.Id); return; }
        if (!ctxMenu) navigate(`/media/${item.Id}`);
      }}
      onContextMenu={isSelecting ? undefined : handleContextMenu}
      onTouchStart={isSelecting ? undefined : handleTouchStart}
      onTouchEnd={isSelecting ? undefined : clearLongPress}
      onTouchMove={isSelecting ? undefined : clearLongPress}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      // `render-tile` : cette grille n'est PAS virtualisée (contrairement à
      // LibraryGrid) et monte tout d'un coup — le moteur saute donc le rendu
      // des cellules hors écran. Sans risque ici : la carte est déjà
      // `overflow-hidden`, rien n'en déborde que `contain: paint` pourrait
      // rogner (cf. theme/rendering.css).
      // `transition-all` énumérait TOUTES les propriétés animables, que le
      // moteur devait alors surveiller sur chaque cellule. Seules deux
      // changent : l'échelle au survol et l'anneau de sélection.
      className={`render-tile group group/card relative cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-[transform,box-shadow] duration-300 hover:scale-[1.03] ${
        isSelected ? "ring-2 ring-[var(--brand)]" : ""
      }`}
      // Décalage d'entrée PLAFONNÉ, comme sur les cartes de rangée. Sans
      // plafond, une liste de trois cents titres faisait démarrer la dernière
      // carte douze secondes après la première — la cascade cesse d'être une
      // cascade et devient une attente.
      style={{ animation: `fadeSlideUp 0.5s ease both`, animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      {isSelecting && (
        <SelectionCheckbox checked={isSelected} onClick={() => selectionMode?.toggle(item.Id)} />
      )}
      <div className="relative aspect-[2/3] bg-tentacle-surface">
        <img
          src={poster} alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy" decoding="async"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
        />
        {/* Même comportement que Home : méta révélée au hover (Watchlist +
            Favoris partagent CollectionGrid → une seule édition les couvre).
            Montée à la demande comme sur l'accueil — ses pastilles portent un
            `backdrop-filter`. `shown` lui rend son fondu de sortie. */}
        {hover.mounted && (
          <CardMetaOverlay item={item} density="compact" reveal="mount" shown={hover.hovered} />
        )}
      </div>

      {!isSelecting && hover.mounted && (
        <CollectionCardBadges
          shown={hover.hovered}
          favorite={localFavorite}
          watchlisted={localWatchlist}
          onToggleFavorite={() => {
            setLocalFavorite(!localFavorite);
            if (localFavorite) removeFav.mutate(); else addFav.mutate();
          }}
          onToggleWatchlist={() => {
            setLocalWatchlist(!localWatchlist);
            if (localWatchlist) removeWatchlist.mutate(); else addWatchlist.mutate();
          }}
        />
      )}

      <div className="p-2.5">
        <p className="text-sm font-medium text-content-primary line-clamp-1">{item.Name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-content-tertiary">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
        </div>
      </div>
      {/* Barre de progression posée SUR le poster : reste claire dans les deux
          thèmes (cf. règle « posé sur média »). */}
      {progress != null && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full" style={{ width: `${progress}%`, background: "var(--progress-fill)" }} />
        </div>
      )}

      {!isSelecting && ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onToggleFavorite={() => setLocalFavorite(!localFavorite)}
          onToggleWatchlist={() => setLocalWatchlist(!localWatchlist)}
        />
      )}
    </div>
  );
}
