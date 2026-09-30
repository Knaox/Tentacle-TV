import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCardToggles, useJellyfinClient, useMediaItem, useRecoLive, useSeriesWatchState, useTentacleConfig } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";
import { ForYouView } from "../../redesign/screens/forYou/ForYouView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { RootStackParamList } from "../../navigation/types";
import { heroModelOf } from "../hero/heroModel";
import { useRecoFilter } from "../reco/useRecoFilter";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useAmbientPalette } from "../screen/useAmbientPalette";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { useForYouModels } from "./useForYouModels";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendations">;

/**
 * « Pour vous » refondu (Apple TV) : `ForYouView` sur LA page de
 * recommandations du compte. En tête, notre meilleure suggestion et pourquoi ;
 * la ligne d'état quand le moteur est désactivé ou démarre à froid ; les
 * étagères de la bibliothèque, raison de chaque carte au focus. La première
 * porte la pastille du filtre de plateformes, qu'un appui retire.
 *
 * OK ouvre la fiche, l'appui long la feuille d'actions (variante reco) — le
 * titre jugé quitte « Pour vous » à sa fermeture (`useTVCardActions`).
 */
export function ForYouRedesign({ navigation }: Props) {
  const { t } = useTranslation();
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  useRecoLive({ token: storage.getItem("tentacle_token") });

  const models = useForYouModels();
  const { filter, removeFilter } = useRecoFilter();
  const heroId = models.heroReco?.jellyfinItemId ?? undefined;
  const { data: heroData, isError: heroFailed } = useMediaItem(heroId);
  const heroItem = heroData && heroData.Id === heroId ? heroData : undefined;
  const toggles = useCardToggles(heroItem ?? ({ Id: "" } as MediaItem));
  const isSeries = heroItem?.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? heroItem?.Id : undefined);

  const fresh = useMemo(
    () =>
      heroItem
        ? heroModelOf(client, t, {
            item: heroItem,
            art: heroItem,
            kicker: t("reco:heroKicker"),
            reason: models.heroReason,
            inWatchlist: toggles.watchlist,
          })
        : null,
    [client, t, heroItem, models.heroReason, toggles.watchlist],
  );
  // La tête attend sa fiche (logo, fond, métadonnées) : au premier affichage,
  // la page se dit en chargement plutôt que de s'afficher sans elle — ensuite,
  // la tête précédente reste le temps que la nouvelle arrive.
  const shownHero = useRef<typeof fresh>(null);
  if (fresh || !heroId || heroFailed) shownHero.current = fresh;
  const hero = shownHero.current;
  const heroPending = !!heroId && !hero && !heroFailed;

  const status = useMemo<StatusPanelProps | null>(() => {
    if (models.isError) {
      return {
        kind: "error",
        title: t("reco:loadError"),
        message: t("reco:tvErrorHint"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: models.refetch },
      };
    }
    if (models.loading || heroPending) return { kind: "loading", title: t("common:loading") };
    if (models.notice === "preparing") return { kind: "loading", title: t("reco:tvPreparingTitle"), message: t("reco:generatingHint") };
    if (models.empty) return { kind: "empty", title: t("reco:tvEmptyTitle"), message: t("reco:tvEmpty") };
    return null;
  }, [models.isError, models.loading, heroPending, models.notice, models.empty, models.refetch, t]);

  const notice = useMemo(
    () =>
      models.notice === "disabled"
        ? { kind: "disabled" as const, text: t("reco:tvDisabledHint") }
        : models.notice === "cold"
          ? { kind: "cold" as const, text: t("reco:tvColdHint") }
          : null,
    [models.notice, t],
  );

  const firstShelf = models.shelves[0];
  const entryKey = status ? (status.primary ? "status:primary" : null) : hero ? "hero:primary" : firstShelf ? `${firstShelf.key}:0` : null;
  const screen = useRedesignScreen({ railKey: "Recommendations", entryKey });
  const { focusedPalette, onFocusCard } = useAmbientPalette(screen.focus);
  const cardActions = useTVCardActions();

  const detail = useCallback((itemId: string) => navigation.navigate("MediaDetail", { itemId }), [navigation]);
  const play = useCallback((itemId: string) => navigation.navigate("Player", { itemId }), [navigation]);
  // Des gestes stables qui lisent l'état du moment.
  const live = useRef({ heroItem, isSeries, watchState, toggles });
  live.current = { heroItem, isSeries, watchState, toggles };
  const onHeroPrimary = useCallback(() => {
    const { heroItem: item, isSeries: series, watchState: state } = live.current;
    if (!item) return;
    if (!series) return play(item.Id);
    // Une série se lit par l'épisode à reprendre ; terminée, sa fiche s'ouvre.
    const episode = state && state.type !== "completed" ? state.episode : undefined;
    if (episode) play(episode.Id);
    else detail(item.Id);
  }, [play, detail]);
  const onHeroSecondary = useCallback(() => {
    if (live.current.heroItem) detail(live.current.heroItem.Id);
  }, [detail]);
  const onHeroToggleList = useCallback(() => {
    if (live.current.heroItem) live.current.toggles.toggleList();
  }, []);

  const { targetOf } = models;
  const onPressCard = useCallback(
    (shelfKey: string, card: CardModel) => {
      const target = targetOf(shelfKey, card.id);
      if (target) detail(target.item.Id);
    },
    [targetOf, detail],
  );
  const { openReco } = cardActions;
  const onLongPressCard = useCallback(
    (shelfKey: string, card: CardModel) => {
      const target = targetOf(shelfKey, card.id);
      if (target) openReco(target.reco);
    },
    [targetOf, openReco],
  );

  const palette = focusedPalette ?? hero?.palette ?? firstShelf?.cards[0]?.palette ?? NEUTRAL_PALETTE;

  return (
    <RedesignScreen screen={screen}>
      <ForYouView
        nav={screen.nav}
        hero={hero}
        notice={notice}
        shelves={models.shelves}
        filter={filter}
        palette={palette}
        status={status}
        onHeroPrimary={onHeroPrimary}
        onHeroSecondary={onHeroSecondary}
        onHeroToggleList={onHeroToggleList}
        onRemoveFilter={removeFilter}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
      />
      {cardActions.sheet}
    </RedesignScreen>
  );
}
