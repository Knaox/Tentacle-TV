import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, TVFocusGuideView, InteractionManager, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist, useWatchedItems,
  useTentacleConfig, useHomeWebSocket, useJellyfinClient,
} from "@tentacle-tv/api-client";
import { doLogout } from "../auth/sessionFlow";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD, TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { useTVNavActions } from "../context/TVNavContext";
import { SelectionModal } from "../components/SelectionModal";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { TVHomeErrorState } from "../components/home/TVHomeErrorState";
import { TVHomeRows } from "../components/home/TVHomeRows";
import { preloadCoreScreens } from "../navigation/AppNavigator";
import { AmbientFocusProvider, usePoseurAmbiant } from "../contexts/AmbientFocusContext";
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
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  // Le serveur pousse `session:revoked` quand l'admin supprime ce jumelage :
  // on se déconfigure et on repart sur l'écran de jumelage (doLogout purge
  // aussi le token Jellyfin caché du direct streaming). Respecte le garde
  // « lecture en cours » de doLogout.
  useHomeWebSocket({
    token: storage.getItem("tentacle_token"),
    onSessionRevoked: () => doLogout(jfClient, storage, queryClient),
  });
  const setFocusedItem = usePoseurAmbiant();
  const { requestRailFocus, lastContentNodeRef } = useTVNavActions();
  // Appui long sur une carte → menu contextuel (Plus d'infos / Lecture)
  const [ctxItem, setCtxItem] = useState<MediaItem | null>(null);

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
      });
      return () => task.cancel();
    }, [queryClient])
  );

  // Retour sur l'accueil (depuis le lecteur, le détail, etc.) : restaurer le
  // focus sur le DERNIER élément de carrousel focalisé — sinon l'autoFocus
  // repart sur la 1re carte (tvOS) ou le moteur natif donne le focus à la
  // sidebar (Android). Sur 1er mount, lastContentNodeRef est null → autoFocus.
  useFocusEffect(
    useCallback(() => {
      /**
       * Le nœud est relu AU MOMENT DE POSER LE FOCUS, jamais capturé à
       * l'armement.
       *
       * Entre les deux, il s'écoule soixante millisecondes pendant lesquelles
       * l'effet ci-dessus invalide « Reprendre », « Prochains épisodes » et
       * « Ma liste » : la liste peut recycler la cellule que la mémoire de
       * focus désigne. Celle-ci s'efface alors elle-même (`FocusableRow`), et
       * relire ici suffit à ne rien envoyer à une vue détruite — ce qui levait
       * « Trying to update non-existent view with tag N ».
       */
      const viser = (): ({ setNativeProps?: (p: object) => void } | null) =>
        lastContentNodeRef.current as { setNativeProps?: (p: object) => void } | null;
      if (!viser()?.setNativeProps) return;
      if (Platform.OS === "ios") {
        // tvOS : hasTVPreferredFocus n'est honoré que sur un cycle false→true.
        let id2: ReturnType<typeof setTimeout>;
        const id1 = setTimeout(() => {
          viser()?.setNativeProps?.({ hasTVPreferredFocus: false });
          id2 = setTimeout(() => viser()?.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
        }, 60);
        return () => { clearTimeout(id1); clearTimeout(id2); };
      }
      // Android : le set vaut requestFocus() immédiat (one-shot).
      const id = setTimeout(() => viser()?.setNativeProps?.({ hasTVPreferredFocus: true }), 60);
      return () => clearTimeout(id);
    }, [lastContentNodeRef])
  );

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

  const navigateToDetail = useCallback((item: MediaItem) => {
    // Épisode → fiche centrée épisode (parité web), plus de redirection série
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const navigateToPlay = useCallback((item: MediaItem) => {
    navigation.navigate("Player", { itemId: item.Id });
  }, [navigation]);

  // Rejumeler depuis l'état d'erreur : doLogout — la purge locale recopiée
  // ici oubliait les credentials et le verrou « lecture en cours ».
  const handleLogout = useCallback(() => {
    doLogout(jfClient, storage, queryClient);
  }, [jfClient, storage, queryClient]);

  const handleCtxSelect = useCallback((value: string) => {
    const item = ctxItem;
    setCtxItem(null);
    if (!item) return;
    if (value === "details") navigateToDetail(item);
    else if (value === "play") navigateToPlay(item);
  }, [ctxItem, navigateToDetail, navigateToPlay]);

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
              resume={resume}
              nextUp={nextUp}
              watchlist={watchlist}
              watched={watched}
              libraries={libraries}
              onPlay={navigateToPlay}
              onDetail={navigateToDetail}
              onLongPress={setCtxItem}
              onItemFocus={setFocusedItem}
              onWrapperLayout={(y) => { rowsWrapperY.current = y; }}
              onRowLayout={(key, y) => rowYMap.current.set(key, y)}
              onRowFocus={scrollToRow}
            />
          </>
        )}
      </ScrollView>
      </TVFocusGuideView>

      {/* Menu contextuel (appui long sur une carte) */}
      {ctxItem && (
        <SelectionModal
          title={ctxItem.Type === "Episode" ? (ctxItem.SeriesName ?? ctxItem.Name) : ctxItem.Name}
          options={[
            { value: "details", label: t("moreInfo") },
            { value: "play", label: t("play") },
          ]}
          selectedValue={null}
          onSelect={handleCtxSelect}
          onClose={() => setCtxItem(null)}
        />
      )}
    </TVScreenFrame>
  );
}
