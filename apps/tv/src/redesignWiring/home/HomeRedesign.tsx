import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useFeaturedItems, useLibraries, useResumeItems } from "@tentacle-tv/api-client";
import { latestAdditionsSeasonId, type MediaItem } from "@tentacle-tv/shared";
import { homeEntryKey, homeLoading } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";
import { HomeView } from "../../redesign/screens/home/HomeView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { useUnpairDevice } from "../../hooks/useUnpairDevice";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { useTVHomeRows } from "../../components/home/useTVHomeRows";
import { useRecoFilterChipRow } from "../../components/reco/useRecoFilterChipRow";
import { useHomeLifecycle } from "../../hooks/useHomeLifecycle";
import type { RootStackParamList } from "../../navigation/types";
import { useRecoFilter } from "../reco/useRecoFilter";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { usePerfReady } from "../../platform/perf";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useAmbientPalette } from "../screen/useAmbientPalette";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { useHomeHero } from "./useHomeHero";
import { useHomeRowModels } from "./useHomeRowModels";
import { useArrivalQuiet } from "./useArrivalQuiet";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

/**
 * L'accueil refondu (Apple TV) : `HomeView`, alimentée par les mêmes données
 * que l'accueil actuel — héros (le mode du compte, gardé par le serveur),
 * rangées dans l'ordre de la mise en page du compte, pastille du filtre de
 * plateformes, lumière de l'œuvre focalisée — dans le cadre du socle
 * (`RedesignScreen` : navigation, Menu, focus d'entrée et de retour).
 *
 * OK : lecture sur une vignette 16:9 (Reprendre, Prochains épisodes, Déjà
 * vu), fiche ailleurs. Appui long : la feuille d'actions, dans la variante de
 * la carte.
 */
export function HomeRedesign({ navigation, route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const unpair = useUnpairDevice();
  useHomeLifecycle();

  const featuredQuery = useFeaturedItems();
  const librariesQuery = useLibraries();
  // La même lecture que la rangée « Reprendre » (cache commun) : une source du héros.
  const resumeQuery = useResumeItems();
  const home = useHomeRowModels();
  const { rows: layout } = useTVHomeRows();
  const filterRowKey = useRecoFilterChipRow(layout);
  const { filter, removeFilter } = useRecoFilter();

  const play = useCallback((item: MediaItem) => navigation.navigate("Player", { itemId: item.Id }), [navigation]);
  // Une carte regroupée des « Derniers ajouts » ouvre la série sur la saison de son dernier ajout.
  const detail = useCallback(
    (item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id, seasonId: latestAdditionsSeasonId(item) }),
    [navigation],
  );

  const focus = useFocusStore();
  const cardActions = useTVCardActions();
  const { openLandscape, openPoster, openReco } = cardActions;
  const sheet = useCallback(
    (item: MediaItem, variant: "landscape" | "poster") => (variant === "landscape" ? openLandscape(item) : openPoster(item)),
    [openLandscape, openPoster],
  );
  // Le héros dans le champ, et aucun panneau par-dessus : sa rotation se
  // suspend quand il en sort, ou qu'un grand panneau s'ouvre devant lui.
  const [heroInView, setHeroInView] = useState(true);
  const hero = useHomeHero(focus, { play, detail, sheet }, heroInView && cardActions.sheet === null);

  // L'état de l'écran d'abord : il décide de l'entrée du focus. L'accueil se
  // montre D'UN BLOC (tv-core `homeLoading`) : les sources du héros et les
  // bibliothèques ont répondu, le premier héros a son art — puis le héros en
  // haut, le focus sur sa lecture, sans page qui remonte.
  const failed = featuredQuery.isError && librariesQuery.isError;
  const settled = (query: { data?: unknown; isError: boolean }) => query.data !== undefined || query.isError;
  const loading = homeLoading({
    failed,
    featuredSettled: settled(featuredQuery),
    resumeSettled: settled(resumeQuery),
    librariesSettled: settled(librariesQuery),
    heroPending: hero.pending,
    heroImagePending: hero.imagePending,
  });
  const empty = !loading && !failed && featuredQuery.data?.length === 0 && home.rows.length === 0 && !home.resume?.length;
  // Le mode de mesure (Android TV, éteint par défaut) : l'accueil est prêt.
  usePerfReady("accueil", !loading && !failed);
  const entryKey = homeEntryKey({ failed, loading, empty, hasHero: hero.hero !== null, firstRowKey: home.rows[0]?.key ?? null });

  // Ses rangées reviennent au début : hors de l'écran, au changement de page, et par Retour.
  const screen = useRedesignScreen({ railKey: "Home", entryKey, focus, rewindRows: true });
  const { ambient, onFocusCard } = useAmbientPalette(focus);

  const retry = useCallback(() => {
    void featuredQuery.refetch();
    void librariesQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    void queryClient.invalidateQueries({ queryKey: ["next-up"], exact: true });
  }, [featuredQuery, librariesQuery, queryClient]);
  // Rejumeler : le déjumelage commun, puis l'écran de jumelage.
  const reconnect = useCallback(() => unpair("home"), [unpair]);

  const quiet = useArrivalQuiet(route.params?.entrance === true);
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
    if (loading) return quiet ? null : { kind: "loading", title: t("common:loading") };
    if (empty) return { kind: "empty", title: t("common:emptyLibrary"), message: t("common:emptyHomeHint") };
    return null;
  }, [failed, loading, empty, quiet, t, retry, reconnect]);

  const { targetOf } = home;
  const onPressCard = useCallback(
    (rowKey: string, card: CardModel) => {
      const target = targetOf(rowKey, card.id);
      if (!target) return;
      if (target.press === "play") play(target.item);
      else detail(target.item);
    },
    [targetOf, play, detail],
  );
  const onLongPressCard = useCallback(
    (rowKey: string, card: CardModel) => {
      const target = targetOf(rowKey, card.id);
      if (!target?.panel) return;
      const { panel } = target;
      if (panel.kind === "media" && panel.variant === "landscape") openLandscape(target.item);
      else if (panel.kind === "reco" && target.reco) openReco(target.reco);
      else openPoster(target.item);
    },
    [targetOf, openLandscape, openPoster, openReco],
  );

  // La lumière quand aucune carte n'impose la sienne (`ambient`, que le fond suit seul).
  const palette = hero.hero?.palette ?? home.rows[0]?.cards[0]?.palette ?? NEUTRAL_PALETTE;

  return (
    <RedesignScreen screen={screen}>
      <HomeView
        nav={screen.nav}
        hero={hero.hero}
        rows={home.rows}
        palette={palette}
        ambient={ambient}
        status={status}
        holdFocus={loading}
        filter={filter}
        filterRowKey={filterRowKey}
        onRemoveFilter={removeFilter}
        onHeroPrimary={hero.onPrimary}
        onHeroSecondary={hero.onSecondary}
        onHeroToggleList={hero.onToggleList}
        onHeroLongPress={hero.onLongPress}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
        onHeroVisibleChange={setHeroInView}
      />
      {cardActions.sheet}
    </RedesignScreen>
  );
}
