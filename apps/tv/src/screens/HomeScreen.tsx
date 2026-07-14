import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, TVFocusGuideView, InteractionManager, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist, useWatchedItems,
  useTentacleConfig, useHomeWebSocket, useJellyfinClient,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import { doLogout } from "../auth/sessionFlow";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { useTVNav } from "../context/TVNavContext";
import { SelectionModal } from "../components/SelectionModal";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { TVEpisodeCard } from "../components/cards/TVEpisodeCard";
import { TV_POSTER_WIDTH, TV_EPISODE_WIDTH } from "../components/cards/cardSizes";
import { FocusableRow } from "../components/focus/FocusableRow";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { Colors, Spacing, HeroConfig } from "../theme/colors";
import { TVHomeErrorState } from "../components/home/TVHomeErrorState";
import { preloadCoreScreens } from "../navigation/AppNavigator";
import { AmbientFocusProvider, useAmbientFocus } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { TVLibraryRow } from "../components/rows/TVLibraryRow";
import { possessiveLibraryName } from "../utils/libraryLabel";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round(SCREEN_H * HeroConfig.heightRatio);

export function HomeScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <HomeScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function HomeScreenInner({ navigation }: Props) {
  const { t, i18n } = useTranslation("common");
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
  const { setFocusedItem } = useAmbientFocus();
  const { requestRailFocus, lastContentNodeRef } = useTVNav();
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
      const node = lastContentNodeRef.current as { setNativeProps?: (p: object) => void } | null;
      if (!node?.setNativeProps) return;
      if (Platform.OS === "ios") {
        // tvOS : hasTVPreferredFocus n'est honoré que sur un cycle false→true.
        let id2: ReturnType<typeof setTimeout>;
        const id1 = setTimeout(() => {
          node.setNativeProps?.({ hasTVPreferredFocus: false });
          id2 = setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
        }, 60);
        return () => { clearTimeout(id1); clearTimeout(id2); };
      }
      // Android : le set vaut requestFocus() immédiat (one-shot).
      const id = setTimeout(() => node.setNativeProps?.({ hasTVPreferredFocus: true }), 60);
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
  // Les rangées vivent dans un wrapper qui chevauche le hero (marginTop
  // négatif) : leurs onLayout sont relatifs au wrapper → on ajoute son offset.
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

  const handleLogout = useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    storage.removeItem("tentacle_jellyfin_token");
    storage.removeItem("tentacle_jellyfin_url");
    setPreferencesToken(null);
    queryClient.clear();
    navigation.reset({ index: 0, routes: [{ name: "PairCode" }] });
  }, [storage, navigation, queryClient]);

  const renderPortraitCard = useCallback((item: MediaItem, _i: number, focused: boolean) => (
    <TVPosterCard item={item} focused={focused} />
  ), []);

  const handleCtxSelect = useCallback((value: string) => {
    const item = ctxItem;
    setCtxItem(null);
    if (!item) return;
    if (value === "details") navigateToDetail(item);
    else if (value === "play") navigateToPlay(item);
  }, [ctxItem, navigateToDetail, navigateToPlay]);

  const renderLandscapeCard = useCallback((item: MediaItem, _i: number, focused: boolean) => (
    <TVEpisodeCard item={item} focused={focused} />
  ), []);

  return (
    <TVScreenFrame>
      {/* Ambient backdrop — sits behind everything, fades to focused item */}
      <TVAmbientBackdrop />
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos. `autoFocus`
          garantit que le focus revient toujours sur un enfant focusable quand
          l'écran regagne le focus (retour d'un player figé qui avait perdu le
          focus) — sinon l'Accueil restait sans focus → blocage. */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
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

            {/* Les rangées CHEVAUCHENT le bas du hero (comme le web -mt-12)
                pour supprimer la bande noire de transition. */}
            <View
              style={{ marginTop: heroItems.length > 0 ? -48 : 0, zIndex: 10 }}
              onLayout={(e) => { rowsWrapperY.current = e.nativeEvent.layout.y; }}
            >
            {resume && resume.length > 0 && (
              <FocusableRow
                title={t("resumeWatching")}
                data={resume}
                renderItem={renderLandscapeCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_EPISODE_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToPlay}
                onItemLongPress={setCtxItem}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("resume", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("resume")}
              />
            )}

            {nextUp && nextUp.length > 0 && (
              <FocusableRow
                title={t("nextEpisodes")}
                data={nextUp}
                renderItem={renderLandscapeCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_EPISODE_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToPlay}
                onItemLongPress={setCtxItem}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("nextUp", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("nextUp")}
              />
            )}

            {watchlist && watchlist.length > 0 && (
              <FocusableRow
                title={t("myList")}
                data={watchlist}
                renderItem={renderPortraitCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_POSTER_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToDetail}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("watchlist", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("watchlist")}
              />
            )}

            {/* « Déjà regardés » (16:9), comme le web */}
            {watched && watched.length > 0 && (
              <FocusableRow
                title={t("alreadyWatched")}
                data={watched}
                renderItem={renderLandscapeCard}
                keyExtractor={(item) => item.Id}
                itemWidth={TV_EPISODE_WIDTH.md}
                style={{ marginTop: Spacing.sectionGap }}
                onItemPress={navigateToPlay}
                onItemLongPress={setCtxItem}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set("watched", e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow("watched")}
              />
            )}

            {(libraries ?? []).map((lib) => (
              <TVLibraryRow
                key={lib.Id}
                libraryId={lib.Id}
                libraryName={possessiveLibraryName(lib.Name, i18n.language)}
                collectionType={lib.CollectionType}
                renderCard={renderPortraitCard}
                onItemPress={navigateToDetail}
                onItemFocus={(item) => setFocusedItem(item)}
                onLayout={(e) => rowYMap.current.set(`lib_${lib.Id}`, e.nativeEvent.layout.y)}
                onRowFocus={() => scrollToRow(`lib_${lib.Id}`)}
              />
            ))}
            </View>
          </>
        )}
      </ScrollView>
      </TVFocusGuideView>

      {/* Menu contextuel (appui long sur une carte) */}
      {ctxItem && (
        <SelectionModal
          title={ctxItem.Type === "Episode" ? (ctxItem.SeriesName ?? ctxItem.Name) : ctxItem.Name}
          options={[
            { value: "details", label: t("moreInfo", { defaultValue: "Plus d'infos" }) },
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
