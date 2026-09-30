import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useFeaturedItems, useJellyfinClient, useLibraries, useTentacleConfig } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";
import { HomeView } from "../../redesign/screens/home/HomeView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { doLogout } from "../../auth/sessionFlow";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { useTVHomeRows } from "../../components/home/useTVHomeRows";
import { useRecoFilterChipRow } from "../../components/reco/useRecoFilterChipRow";
import { useHomeLifecycle } from "../../hooks/useHomeLifecycle";
import type { RootStackParamList } from "../../navigation/types";
import { useRecoFilter } from "../reco/useRecoFilter";
import { useFocusStore } from "../focus/focusStore";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useAmbientPalette } from "../screen/useAmbientPalette";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { useHomeHero } from "./useHomeHero";
import { useHomeRowModels } from "./useHomeRowModels";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

/**
 * L'accueil refondu (Apple TV) : `HomeView`, alimentée par les mêmes données
 * que l'accueil actuel — héros (reprises, sinon sélection du serveur),
 * rangées dans l'ordre de la mise en page du compte, pastille du filtre de
 * plateformes, lumière de l'œuvre focalisée — dans le cadre du socle
 * (`RedesignScreen` : navigation, Menu, focus d'entrée et de retour).
 *
 * OK : lecture sur une vignette 16:9 (reprise, prochains, déjà vu), fiche
 * ailleurs. Appui long : la feuille d'actions, dans la variante de la carte.
 */
export function HomeRedesign({ navigation }: Props) {
  const { t } = useTranslation();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  useHomeLifecycle();

  const featuredQuery = useFeaturedItems();
  const librariesQuery = useLibraries();
  const home = useHomeRowModels();
  const { rows: layout } = useTVHomeRows();
  const filterRowKey = useRecoFilterChipRow(layout);
  const { filter, removeFilter } = useRecoFilter();

  const play = useCallback((item: MediaItem) => navigation.navigate("Player", { itemId: item.Id }), [navigation]);
  const detail = useCallback((item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id }), [navigation]);

  const focus = useFocusStore();
  const hero = useHomeHero(focus, home.resume, { play, detail });

  // L'état de l'écran d'abord : il décide de l'entrée du focus. Le premier
  // héros attend l'art de son titre (logo, fond) : l'écran se dit en
  // chargement plutôt que de s'afficher sans lui.
  const failed = featuredQuery.isError && librariesQuery.isError;
  const loading =
    !failed && (((featuredQuery.isLoading || librariesQuery.isLoading) && !featuredQuery.data && !librariesQuery.data) || hero.pending);
  const empty = !loading && !failed && featuredQuery.data?.length === 0 && home.rows.length === 0 && !home.resume?.length;
  const firstCard = home.rows[0] ? `${home.rows[0].key}:0` : null;
  const entryKey = failed ? "status:primary" : loading || empty ? null : hero.hero ? "hero:primary" : firstCard;

  const screen = useRedesignScreen({ railKey: "Home", entryKey, focus });
  const { focusedPalette, onFocusCard } = useAmbientPalette(focus);
  const cardActions = useTVCardActions();

  const retry = useCallback(() => {
    void featuredQuery.refetch();
    void librariesQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    void queryClient.invalidateQueries({ queryKey: ["next-up"], exact: true });
  }, [featuredQuery, librariesQuery, queryClient]);
  // Rejumeler : `doLogout`, qui oublie aussi les identifiants et respecte le
  // verrou « lecture en cours ».
  const reconnect = useCallback(() => doLogout(jfClient, storage, queryClient), [jfClient, storage, queryClient]);

  const status = useMemo<StatusPanelProps | null>(() => {
    if (failed) {
      return {
        kind: "error",
        title: t("common:connectionError"),
        message: t("common:offlineMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: retry },
        secondary: { label: t("common:reconnect"), icon: "logout", onPress: reconnect },
      };
    }
    if (loading) return { kind: "loading", title: t("common:loading") };
    if (empty) return { kind: "empty", title: t("common:emptyLibrary"), message: t("common:emptyHomeHint") };
    return null;
  }, [failed, loading, empty, t, retry, reconnect]);

  const { targetOf } = home;
  const onPressCard = useCallback(
    (rowKey: string, card: CardModel) => {
      const target = targetOf(rowKey, card.id);
      if (!target) return;
      if (target.kind === "play") play(target.item);
      else detail(target.item);
    },
    [targetOf, play, detail],
  );
  const { openLandscape, openPoster, openReco } = cardActions;
  const onLongPressCard = useCallback(
    (rowKey: string, card: CardModel) => {
      const target = targetOf(rowKey, card.id);
      if (!target) return;
      if (target.sheet === "landscape") openLandscape(target.item);
      else if (target.sheet === "reco" && target.reco) openReco(target.reco);
      else openPoster(target.item);
    },
    [targetOf, openLandscape, openPoster, openReco],
  );

  const palette = focusedPalette ?? hero.hero?.palette ?? home.rows[0]?.cards[0]?.palette ?? NEUTRAL_PALETTE;

  return (
    <RedesignScreen screen={screen}>
      <HomeView
        nav={screen.nav}
        hero={hero.hero}
        rows={home.rows}
        palette={palette}
        status={status}
        filter={filter}
        filterRowKey={filterRowKey}
        onRemoveFilter={removeFilter}
        onHeroPrimary={hero.onPrimary}
        onHeroSecondary={hero.onSecondary}
        onHeroToggleList={hero.onToggleList}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
      />
      {cardActions.sheet}
    </RedesignScreen>
  );
}
