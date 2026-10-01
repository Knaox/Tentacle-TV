import { useCallback, useMemo, useRef } from "react";
import { ScrollView, TVFocusGuideView } from "react-native";
import { useTVRemote } from "../components/focus/useTVRemote";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useWatchlist, useWatchedItems,
  useJellyfinClient,
} from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { useUnpairDevice } from "../hooks/useUnpairDevice";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD, TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { useTVNavActions } from "../context/TVNavContext";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { TVHomeErrorState } from "../components/home/TVHomeErrorState";
import { useTVCardActions } from "../components/cards/actions/useTVCardActions";
import { TVHomeRows } from "../components/home/TVHomeRows";
import type { TVHomeRowData, TVHomeRowHandlers } from "../components/home/tvHomeRowRegistry";
import { useTVHomeRows } from "../components/home/useTVHomeRows";
import { useRecoFilterChipRow } from "../components/reco/useRecoFilterChipRow";
import { recoAmbientTarget } from "../components/reco/recoAmbientTarget";
import { useHomeFocusRestore } from "../hooks/useHomeFocusRestore";
import { useHomeLifecycle } from "../hooks/useHomeLifecycle";
import { AmbientFocusProvider, useAmbientSetter } from "../contexts/AmbientFocusContext";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { HomeRedesign } from "../redesignWiring/home/HomeRedesign";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { Spacing } from "../theme/colors";
import { SHOWS_VERTICAL_SCROLL_INDICATOR } from "../theme/focus";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const SCREEN_H = require("react-native").Dimensions.get("window").height;
const HERO_H = Math.round((SCREEN_H * TV_BANNER_CARD.homeHeightVh) / 100);

/** L'accueil : la refonte sur Apple TV, l'UI actuelle sur Android TV (`redesignGate.ts`). */
export function HomeScreen(props: Props) {
  return REDESIGN_ACTIVE ? <HomeRedesign {...props} /> : <LegacyHomeScreen {...props} />;
}

function LegacyHomeScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <HomeScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function HomeScreenInner({ navigation }: Props) {
  const jfClient = useJellyfinClient();
  // Données en direct, rafraîchissement au retour, préchauffage des écrans :
  // la vie de l'accueil, commune aux deux UI.
  useHomeLifecycle();
  const setFocusedItem = useAmbientSetter();
  const { requestRailFocus, lastContentNodeRef, railFocusedRef } = useTVNavActions();
  // Appui long sur une carte → la feuille d'actions du modèle partagé.
  const cardActions = useTVCardActions();

  // Retour sur l'accueil : le focus revient sur la dernière carte focalisée.
  useHomeFocusRestore(lastContentNodeRef);

  // Retour ouvre le rail (le geste de Netflix) ; depuis le rail, il rend la main au système — sur
  // Android, c'est quitter l'application (tvOS le fait seul à la racine).
  useTVRemote({ onBack: () => (railFocusedRef.current ? false : requestRailFocus()) });

  const scrollViewRef = useRef<ScrollView>(null);
  const rowYMap = useRef<Map<string, number>>(new Map());
  // Les rangées vivent dans un wrapper : leurs onLayout sont relatifs à lui →
  // on ajoute son offset. (Il ne chevauche PAS le hero : la carte porte son
  // écart bas, cf. TVHomeRows.)
  const rowsWrapperY = useRef(0);

  const scrollToRow = useCallback((key: string) => {
    const y = rowYMap.current.get(key);
    if (y != null) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, rowsWrapperY.current + y - Spacing.rowScrollTop - TV_OVERSCAN_PT.y), animated: true });
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
  // Recommandations : la TV ne montre que des titres en bibliothèque — OK
  // ouvre la fiche, l'appui long la feuille d'actions (variante reco).
  const openRecoDetail = useCallback((item: RecoRowItem) => { if (item.jellyfinItemId) openDetail(item.jellyfinItemId); }, [openDetail]);
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
    onLandscapeLongPress: cardActions.openLandscape,
    onPosterLongPress: cardActions.openPoster,
    onItemFocus: setFocusedItem,
    onRecoPress: openRecoDetail,
    onRecoLongPress: cardActions.openReco,
    onRecoFocus,
    onRowLayout: (key, y) => rowYMap.current.set(key, y),
    onRowFocus: scrollToRow,
  }), [
    navigateToPlay, navigateToDetail, cardActions.openLandscape, cardActions.openPoster, setFocusedItem,
    openRecoDetail, cardActions.openReco, onRecoFocus, scrollToRow,
  ]);

  // Rejumeler depuis l'état d'erreur : le déjumelage commun.
  const unpair = useUnpairDevice();
  const handleLogout = useCallback(() => unpair("home"), [unpair]);

  return (
    <TVScreenFrame backdrop={<TVAmbientBackdrop />}>
      {/* @ts-expect-error — TVFocusGuideView props from react-native-tvos. `autoFocus`
          garantit que le focus revient toujours sur un enfant focusable quand
          l'écran regagne le focus (retour d'un player figé qui avait perdu le
          focus) — sinon l'Accueil restait sans focus → blocage. */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
      {/* Le retrait DROIT de `TVScreenFrame` est repris à l'intérieur du
          défilement : la fenêtre de clip va jusqu'au bord de l'écran, et le halo
          de la bannière n'est pas rogné à la gouttière. À GAUCHE, le clip s'arrête
          au bord du rail : élargi jusqu'à l'écran, le halo glissait sous les
          icônes du rail en défilant (le rail n'a qu'un voile, pas de fond). Les
          56 pt de gouttière lui restent — comme aux rangées (FocusableRow).
          En HAUT et en BAS aussi, la fenêtre va jusqu'aux bords : coupé au
          retrait d'overscan, le défilement dessinait un cadre noir de 54 pt
          autour de l'app sur un grand écran moderne, qui n'a pas d'overscan. */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, marginRight: -TV_OVERSCAN_PT.x, marginVertical: -TV_OVERSCAN_PT.y }}
        contentContainerStyle={{
          paddingRight: TV_OVERSCAN_PT.x,
          paddingTop: TV_OVERSCAN_PT.y,
          paddingBottom: 96 + TV_OVERSCAN_PT.y,
        }}
        overScrollMode="never"
        showsVerticalScrollIndicator={SHOWS_VERTICAL_SCROLL_INDICATOR}
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

      {/* La feuille d'actions (appui long sur une carte) */}
      {cardActions.sheet}
    </TVScreenFrame>
  );
}
