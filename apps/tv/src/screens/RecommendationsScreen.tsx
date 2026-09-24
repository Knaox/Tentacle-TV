import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, TVFocusGuideView, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  reasonToText, useJellyfinClient, useMediaItem, useRecoLive, useRecoPage, useRecoSettings, useTentacleConfig,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { tvRecoHero, tvRecoNotice, tvRecoShelves } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { TVHeroBillboard } from "../components/hero/TVHeroBillboard";
import { SkeletonHero, SkeletonRow } from "../components/SkeletonLoader";
import { TVHomeContextMenu, type HomeContextTarget } from "../components/home/TVHomeContextMenu";
import { TVRecoShelvesList, TVRecoNoticeLine } from "../components/reco/TVRecoShelvesList";
import { recoAmbientTarget } from "../components/reco/recoAmbientTarget";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVNavActions } from "../context/TVNavContext";
import { AmbientFocusProvider, useAmbientSetter } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { Spacing } from "../theme/colors";
import { SHOWS_VERTICAL_SCROLL_INDICATOR } from "../theme/focus";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendations">;

const EMPTY: number[] = [];

export function RecommendationsScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <RecommendationsInner {...props} />
    </AmbientFocusProvider>
  );
}

/**
 * « Pour vous », pensé pour la télévision : une tête (le titre que le moteur
 * place le plus haut, s'il est sur le serveur), puis des étagères de la
 * bibliothèque — sans doublon d'une rangée à l'autre, sans rien qu'il faudrait
 * aller demander ailleurs (`tvRecoShelves`, commun avec la LG). Le filtre de
 * plateformes du compte s'applique ; il se retire d'un appui sur sa pastille.
 */
function RecommendationsInner({ navigation }: Props) {
  const { t } = useTranslation("reco");
  const { storage } = useTentacleConfig();
  const jfClient = useJellyfinClient();
  const setFocusedItem = useAmbientSetter();
  const { requestRailFocus } = useTVNavActions();
  useRecoLive({ token: storage.getItem("tentacle_token") });

  const settings = useRecoSettings();
  // Le filtre du compte d'abord : sans cette garde, la page « toutes
  // plateformes » partirait avant la page filtrée (cf. TVRecoRow).
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page, isError } = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady });

  const hero = useMemo(() => tvRecoHero(page), [page]);
  const shelves = useMemo(() => tvRecoShelves(page, { hero }), [page, hero]);
  const notice = tvRecoNotice(page, shelves);
  const { data: heroItem } = useMediaItem(hero?.jellyfinItemId ?? undefined);
  const heroItems = useMemo(() => (heroItem ? [heroItem] : []), [heroItem]);
  // « Notre meilleure suggestion · Avec … » : la tête dit pourquoi elle est là.
  const heroReason = hero?.reasons.map((r) => reasonToText(r, t)).find((text): text is string => !!text);
  const heroKicker = heroReason ? `${t("heroKicker")} · ${heroReason}` : t("heroKicker");

  const noticeText = notice === "disabled" ? t("tvDisabledHint")
    : notice === "cold" ? t("tvColdHint")
    : notice === "preparing" ? t("generatingHint")
    : page && shelves.length === 0 && !hero ? t("tvEmpty")
    : null;

  const scrollRef = useRef<ScrollView>(null);
  const shelfY = useRef(new Map<string, number>());
  const shelvesTop = useRef(0);
  const onShelfLayout = useCallback((key: string, y: number) => shelfY.current.set(key, y), []);
  const onShelfFocus = useCallback((key: string) => {
    const y = shelfY.current.get(key);
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, shelvesTop.current + y - Spacing.rowScrollTop), animated: true });
  }, []);

  const [ctxTarget, setCtxTarget] = useState<HomeContextTarget | null>(null);
  const openDetail = useCallback((itemId: string) => navigation.navigate("MediaDetail", { itemId }), [navigation]);
  const openPlayer = useCallback((itemId: string) => navigation.navigate("Player", { itemId }), [navigation]);
  const onPress = useCallback((item: RecoRowItem) => { if (item.jellyfinItemId) openDetail(item.jellyfinItemId); }, [openDetail]);
  const onLongPress = useCallback((item: RecoRowItem) => setCtxTarget({ kind: "reco", item }), []);
  const onItemFocus = useCallback(
    (item: RecoRowItem) => setFocusedItem(recoAmbientTarget(item, jfClient)),
    [setFocusedItem, jfClient],
  );

  // Arrivée par le rail : le bouton Lecture de la tête publie lui-même
  // l'entrée du contenu (`TVHeroContent`), comme sur l'accueil.
  useTVRemote({ onBack: () => requestRailFocus() });

  const loading = !page && !isError;

  return (
    <TVScreenFrame backdrop={<TVAmbientBackdrop />}>
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, marginLeft: -RAIL_COLLAPSED, marginRight: -TV_OVERSCAN_PT.x }}
          contentContainerStyle={{ paddingLeft: RAIL_COLLAPSED, paddingRight: TV_OVERSCAN_PT.x, paddingBottom: 96 }}
          overScrollMode="never"
          showsVerticalScrollIndicator={SHOWS_VERTICAL_SCROLL_INDICATOR}
        >
          {loading ? (
            <>
              <SkeletonHero height={420} />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            <>
              {heroItems.length > 0 && (
                <TVHeroBillboard
                  items={heroItems}
                  onPlay={(item: MediaItem) => openPlayer(item.Id)}
                  onDetail={(item: MediaItem) => openDetail(item.Id)}
                  onBannerFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                  kicker={heroKicker}
                />
              )}
              <TVRecoNoticeLine text={noticeText} />
              <View onLayout={(e) => { shelvesTop.current = e.nativeEvent.layout.y; }}>
                <TVRecoShelvesList
                  shelves={shelves}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  onItemFocus={onItemFocus}
                  onShelfLayout={onShelfLayout}
                  onShelfFocus={onShelfFocus}
                />
              </View>
            </>
          )}
        </ScrollView>
      </TVFocusGuideView>

      <TVHomeContextMenu target={ctxTarget} onClose={() => setCtxTarget(null)} onDetail={openDetail} onPlay={openPlayer} />
    </TVScreenFrame>
  );
}
