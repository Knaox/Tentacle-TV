/**
 * Octave mobile — les albums hors bibliothèque VUS DÉFILER, préparés à l'arrêt (`warmVisibleAlbums` d'api-client,
 * règle `albumWarmup` du partagé). Une page qui porte des étagères d'albums crée sa portée (`useAlbumWarmupPage`),
 * la pose (`AlbumWarmupProvider`) et branche sa liste verticale ; chaque étagère dit ce qu'elle montre (`useShelfWarmup`). À l'arrêt
 * (`WARM_SETTLE_MS` sans mouvement, ni vertical ni horizontal), seules les étagères DANS la fenêtre comptent
 * (`measureInWindow`), leurs cartes visibles dans l'ordre de la page. Hors d'une portée : inerte.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { Dimensions, type View, type ViewToken } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { warmModeOf, warmVisibleAlbums } from "@tentacle-tv/api-client";
import { WARM_SETTLE_MS } from "@tentacle-tv/shared/octave";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { useOctavePagesProvider } from "./pagesEnv";

interface ShelfEntry {
  /** `null` : la liste remplit la page (une grille), toujours dans la fenêtre. */
  ref: RefObject<View | null> | null;
  shown: readonly MusicAlbum[];
}

interface WarmupScope {
  register(id: number, entry: ShelfEntry): void;
  drop(id: number): void;
  moving(): void;
  settle(): void;
}

const Ctx = createContext<WarmupScope | null>(null);
let nextShelf = 0;

function visibleIn(ref: RefObject<View | null> | null): Promise<boolean> {
  if (ref === null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(false);
    node.measureInWindow((_x, y, _w, h) => resolve(h > 0 && y + h > 0 && y < Dimensions.get("window").height));
  });
}

/**
 * La portée d'une page : à poser par `AlbumWarmupProvider`, et `scroll` sur sa liste VERTICALE (le doigt la pose
 * en mouvement, son arrêt compte).
 */
export function useAlbumWarmupPage() {
  const qc = useQueryClient();
  const provider = useOctavePagesProvider();
  const shelves = useRef(new Map<number, ShelfEntry>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = warmModeOf(provider) !== null;

  const fire = useCallback(async () => {
    const entries = [...shelves.current.entries()].sort(([a], [b]) => a - b).map(([, e]) => e);
    const seen = await Promise.all(entries.map((e) => visibleIn(e.ref)));
    const albums = entries.filter((_, i) => seen[i]).flatMap((e) => e.shown);
    if (albums.length > 0) warmVisibleAlbums(qc, provider, albums);
  }, [qc, provider]);

  const settle = useCallback(() => {
    if (!active) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void fire();
    }, WARM_SETTLE_MS);
  }, [active, fire]);

  const moving = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => moving, [moving]);

  const scope = useMemo<WarmupScope>(
    () => ({
      register: (id, entry) => {
        shelves.current.set(id, entry);
        settle();
      },
      drop: (id) => void shelves.current.delete(id),
      moving,
      settle,
    }),
    [moving, settle],
  );
  // Une liste ordinaire (`scroll`) ou animée (`motion`, pour `useOctavePageScroll`).
  const scroll = useMemo(() => ({ onScrollBeginDrag: moving, onMomentumScrollBegin: moving, onScrollEndDrag: settle, onMomentumScrollEnd: settle }), [moving, settle]);
  const motion = useMemo(() => ({ onMove: moving, onSettle: settle }), [moving, settle]);
  return { scope, scroll, motion };
}

export function AlbumWarmupProvider({ scope, children }: { scope: WarmupScope; children: ReactNode }) {
  return <Ctx.Provider value={scope}>{children}</Ctx.Provider>;
}

const VIEWABILITY = { itemVisiblePercentThreshold: 50, minimumViewTime: 0 };

/**
 * Une étagère (ou une grille) d'albums : sa vue (`ref`) et ses gestes. `albumOf` dit l'album d'une cellule
 * (`null` : pas un album). Les cartes VISIBLES seules comptent.
 */
export function useShelfWarmup<T>(albumOf: ((item: T) => MusicAlbum | null) | undefined, fillsPage = false) {
  const outer = useContext(Ctx);
  const scope = albumOf ? outer : null;
  const ref = useRef<View | null>(null);
  const id = useRef(nextShelf++).current;
  // La FlatList refuse qu'`onViewableItemsChanged` change : le geste lit la portée et la règle par des refs.
  const live = useRef({ scope, albumOf });
  live.current = { scope, albumOf };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const { scope: s, albumOf: of } = live.current;
    if (s && of) s.register(id, { ref: fillsPage ? null : ref, shown: viewableItems.map((v) => of(v.item as T)).filter((a): a is MusicAlbum => a !== null) });
  }).current;
  useEffect(() => () => scope?.drop(id), [scope, id]);
  return useMemo(
    () =>
      scope
        ? { ref, onViewableItemsChanged, viewabilityConfig: VIEWABILITY, onScrollBeginDrag: scope.moving, onMomentumScrollBegin: scope.moving, onScrollEndDrag: scope.settle, onMomentumScrollEnd: scope.settle }
        : { ref, onViewableItemsChanged: undefined, viewabilityConfig: undefined },
    [scope, onViewableItemsChanged],
  );
}
