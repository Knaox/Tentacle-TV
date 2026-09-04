import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, TVFocusGuideView, InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist, useWatchedItems,
  useTentacleConfig, useHomeWebSocket, useJellyfinClient, useRecoLive,
} from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { doLogout } from "../auth/sessionFlow";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD, TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { useTVNavActions } from "../context/TVNavContext";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { TVHomeErrorState } from "../components/home/TVHomeErrorState";
import { TVHomeContextMenu } from "../components/home/TVHomeContextMenu";
import type { HomeContextTarget } from "../components/home/TVHomeContextMenu";
import { TVHomeRows } from "../components/home/TVHomeRows";
import type { TVHomeRowData, TVHomeRowHandlers } from "../components/home/tvHomeRowRegistry";
import { useTVHomeRows } from "../components/home/useTVHomeRows";
import { useRecoFilterChipRow } from "../components/reco/useRecoFilterChipRow";
import { recoAmbientTarget } from "../components/reco/recoAmbientTarget";
import { useHomeFocusRestore } from "../hooks/useHomeFocusRestore";
import { preloadCoreScreens } from "../navigation/AppNavigator";
import { AmbientFocusProvider, useAmbientSetter } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round((SCREEN_H * TV_BANNER_CARD.homeHeightVh) / 100);

export function HomeScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <HomeScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function HomeScreenInner({ navigation }: Props) {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  // Le serveur pousse `session:revoked` quand l'admin supprime ce jumelage :
  // on se déconfigure et on repart sur l'écran de jumelage (doLogout purge
  // aussi le token Jellyfin caché du direct streaming). Respecte le garde
  // « lecture en cours » de doLogout.
  const token = storage.getItem("tentacle_token");
  useHomeWebSocket({
    token,
    onSessionRevoked: () => doLogout(jfClient, storage, queryClient),
  });
  // Les recommandations reconstruites en fond arrivent en silence (reco:update).
  useRecoLive({ token });
  const setFocusedItem = useAmbientSetter();
  const { requestRailFocus, lastContentNodeRef } = useTVNavActions();
  // Appui long sur une carte → menu contextuel (Plus d'infos / Lecture)
  const [ctxTarget, setCtxTarget] = useState<HomeContextTarget | null>(null);

  // Invalidate volatile queries when screen regains focus (e.g. after Player).
  // - Skip du premier mount (les queries démarrent déjà → évite le double-fetch).
  // - `exact` sur next-up : le préfixe matchait aussi les 2 requêtes supplément
  //   (Limit 500) → rafale réseau + jank à chaque retour sur l'accueil.
  // - Différé après les interactions pour ne pas concurrencer la transition.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) { firstFocusRef.current = false; return; }
      const task = InteractionManager.runAfterInteractions(() => {
        queryClient.invalidateQueries({ queryKey: ["resume-items"] });
        queryClient.invalidateQueries({ queryKey: ["next-up"], exact: true });
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
      });
      return () => task.cancel();
    }, [queryClient])
  );

  // Retour sur l'accueil : le focus revient sur la dernière carte focalisée.
  useHomeFocusRestore(lastContentNodeRef);

  // BACK sur l'accueil → focus sur le rail (pattern tvOS/Netflix)
  useTVRemote({ onBack: () => requestRailFocus() });

  // Préchauffe les écrans lazy (Library/MediaDetail/Player) une fois l'accueil
  // interactif — le premier accès n'attend plus le parse/exec du module.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(preloadCoreScreens);
    return () => task.cancel();
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  const rowYMap = useRef<Map<string, number>>(new Map());
  // Les rangées vivent dans un wrapper : leurs onLayout sont relatifs à lui →
  // on ajoute son offset. (Il ne chevauche PAS le hero : la carte porte son
  // écart bas, cf. TVHomeRows.)
  const rowsWrapperY = useRef(0);

  const scrollToRow = useCallback((key: string) => {
    const y = rowYMap.current.get(key);
    if (y != null) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, rowsWrapperY.current + y - 80), animated: true });
    }
  }, []);

  const featuredQuery = useFeaturedItems();
  const resumeQuery = useResumeItems();
  const nextUpQuery = useNextUp();
  const librariesQuery = useLibraries();
  const watchlistQuery = useWatchlist();
  const watchedQuery = useWatchedItems();
  const { rows } = useTVHomeRows();
  const filterChipRowKey = useRecoFilterChipRow(rows);

  const featured = featuredQuery.data;
  const resume = resumeQuery.data;
  const nextUp = nextUpQuery.data;
  const libraries = librariesQuery.data;
  const watchlist = watchlistQuery.data;
  const watched = watchedQuery.data;

  // Bannière : visionnages à REPRENDRE en priorité, sinon mis en avant (web).
  const heroItems = (resume && resume.length > 0) ? resume.slice(0, 5) : (featured ?? []);

  const allFailed = featuredQuery.isError && librariesQuery.isError;
  const isLoading = (featuredQuery.isLoading || librariesQuery.isLoading) && !featured && !libraries;

  // Épisode → fiche centrée épisode (parité web), plus de redirection série.
  const openDetail = useCallback((itemId: string) => navigation.navigate("MediaDetail", { itemId }), [navigation]);
  const openPlayer = useCallback((itemId: string) => navigation.navigate("Player", { itemId }), [navigation]);
  const navigateToDetail = useCallback((item: MediaItem) => openDetail(item.Id), [openDetail]);
  const navigateToPlay = useCallback((item: MediaItem) => openPlayer(item.Id), [openPlayer]);
  const openContextMenu = useCallback((item: MediaItem) => setCtxTarget({ kind: "media", item }), []);
  // Recommandations : la TV ne montre que des titres en bibliothèque — OK
  // ouvre la fiche, l'appui long le menu (Plus d'infos, Lecture, Ne plus me
  // proposer).
  const openRecoDetail = useCallback((item: RecoRowItem) => { if (item.jellyfinItemId) openDetail(item.jellyfinItemId); }, [openDetail]);
  const openRecoContextMenu = useCallback((item: RecoRowItem) => setCtxTarget({ kind: "reco", item }), []);
  const onRecoFocus = useCallback(
    (item: RecoRowItem) => setFocusedItem(recoAmbientTarget(item, jfClient)),
    [setFocusedItem, jfClient],
  );

  const librariesById = useMemo(() => {
    const map: TVHomeRowData["librariesById"] = new Map();
    for (const lib of libraries ?? []) map.set(lib.Id, { id: lib.Id, name: lib.Name, collectionType: lib.CollectionType });
    return map;
  }, [libraries]);
  const rowData = useMemo<TVHomeRowData>(
    () => ({ resume, nextUp, watchlist, watched, librariesById, filterChipRowKey }),
    [resume, nextUp, watchlist, watched, librariesById, filterChipRowKey],
  );
  const rowHandlers = useMemo<TVHomeRowHandlers>(() => ({
    onPlay: navigateToPlay,
    onDetail: navigateToDetail,
    onLongPress: openContextMenu,
    onItemFocus: setFocusedItem,
    onRecoPress: openRecoDetail,
    onRecoLongPress: openRecoContextMenu,
    onRecoFocus,
    onRowLayout: (key, y) => rowYMap.current.set(key, y),
    onRowFocus: scrollToRow,
  }), [navigateToPlay, navigateToDetail, openContextMenu, setFocusedItem, openRecoDetail, openRecoContextMenu, onRecoFocus, scrollToRow]);

  // Rejumeler depuis l'état d'erreur : doLogout — la purge locale recopiée
  // ici oubliait les credentials et le verrou « lecture en cours ».
  const handleLogout = useCallback(() => {
    doLogout(jfClient, storage, queryClient);
  }, [jfClient, storage, queryClient]);

  return (
    <TVScreenFrame>
      {/* Ambient backdrop — sits behind everything, fades to focused item */}
      <TVAmbientBackdrop />
      {/* @ts-expect-error — TVFocusGuideView props from react-native-tvos. `autoFocus`
          garantit que le focus revient toujours sur un enfant focusable quand
          l'écran regagne le focus (retour d'un player figé qui avait perdu le
          focus) — sinon l'Accueil restait sans focus → blocage. */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
      {/* Les retraits de `TVScreenFrame` sont repris à l'intérieur du défilement :
          la fenêtre de clip va jusqu'aux bords de l'écran, le contenu ne bouge pas
          d'un point. Sans cela le halo de la bannière était rogné à la gouttière
          de 56 pt — il ourlait la carte au lieu de l'entourer. */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, marginLeft: -RAIL_COLLAPSED, marginRight: -TV_OVERSCAN_PT.x }}
        contentContainerStyle={{
          paddingLeft: RAIL_COLLAPSED,
          paddingRight: TV_OVERSCAN_PT.x,
          paddingBottom: 96,
        }}
        overScrollMode="never"
      >
        {allFailed && (
          <TVHomeErrorState
            errorMessage={featuredQuery.error?.message}
            onRetry={() => {
              featuredQuery.refetch();
              resumeQuery.refetch();
              nextUpQuery.refetch();
              librariesQuery.refetch();
            }}
            onLogout={handleLogout}
          />
        )}

        {/* Loading skeleton */}
        {!allFailed && isLoading && (
          <>
            <SkeletonHero height={HERO_H} />
            <SkeletonRow landscape />
            <SkeletonRow />
          </>
        )}

        {/* Content */}
        {!allFailed && !isLoading && (
          <>
            {heroItems.length > 0 && (
              <TVHeroBillboard
                items={heroItems}
                onPlay={navigateToPlay}
                onDetail={navigateToDetail}
                onBannerFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
                // PAS d'onItemChange : la rotation du carrousel ne doit pas
                // changer le fond ambient (réservé au focus des cartes).
              />
            )}

            <TVHomeRows
              rows={rows}
              data={rowData}
              handlers={rowHandlers}
              onWrapperLayout={(y) => { rowsWrapperY.current = y; }}
            />
          </>
        )}
      </ScrollView>
      </TVFocusGuideView>

      {/* Menu contextuel (appui long sur une carte) */}
      <TVHomeContextMenu
        target={ctxTarget}
        onClose={() => setCtxTarget(null)}
        onDetail={openDetail}
        onPlay={openPlayer}
      />
    </TVScreenFrame>
  );
}
