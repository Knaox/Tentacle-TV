import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  useCardToggles,
  useJellyfinClient,
  useMediaItem,
  useRecoCardHold,
  useRecoLive,
  useSendRecoFeedback,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardPressOf, forYouEntryKey, holdPanelOf } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";
import { ForYouView } from "../../redesign/screens/forYou/ForYouView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { useSectionHead } from "../../platform/tvos/focus/sectionEntry";
import type { RootStackParamList } from "../../navigation/types";
import { heroModelOf } from "../hero/heroModel";
import { useRecoFilter } from "../reco/useRecoFilter";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useAmbientPalette } from "../screen/useAmbientPalette";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import type { AbsentTitle } from "../vigie/absentTitle";
import { useTitleRequests } from "../vigie/useTitleRequests";
import { useForYouModels } from "./useForYouModels";

/** La clé de la puce du filtre de plateformes (`ForYouView`). */
const FOR_YOU_FILTER_KEY = "filter:remove";

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
 *
 * Garde Vigie ouverte, un titre HORS bibliothèque se demande à OK (un film
 * d'un geste, une série par la feuille de ses saisons — `useTitleRequests`),
 * et l'appui maintenu ouvre son panneau, avec « Ne plus me proposer ». Sa
 * carte est tenue tant qu'une de ses feuilles est ouverte : demandé, il
 * quitte « Pour vous » à leur fermeture, jamais dessous.
 */
export function ForYouRedesign({ navigation }: Props) {
  const { t } = useTranslation();
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  useRecoLive({ token: storage.getItem("tentacle_token") });

  const requests = useTitleRequests();
  const models = useForYouModels(requests?.gate ?? null);
  useRecoCardHold(requests?.heldKey ?? null);
  const { mutate: sendFeedback } = useSendRecoFeedback();
  const { filter, removeFilter } = useRecoFilter();
  const heroId = models.heroReco?.jellyfinItemId ?? undefined;
  const { data: heroData, isError: heroFailed } = useMediaItem(heroId);
  const heroItem = heroData && heroData.Id === heroId ? heroData : undefined;
  const toggles = useCardToggles(heroItem ?? ({ Id: "" } as MediaItem));

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
    // Sans clé TMDB, « vos premiers visionnages nourriront cette page » serait faux.
    if (models.empty && models.notice === "tmdbOff") {
      return { kind: "empty", title: t("reco:tvTmdbOffTitle"), message: `${t("reco:tmdbOffText")} ${t("reco:tmdbOffDeviceHint")}` };
    }
    if (models.empty) return { kind: "empty", title: t("reco:tvEmptyTitle"), message: t("reco:tvEmpty") };
    return null;
  }, [models.isError, models.loading, heroPending, models.notice, models.empty, models.refetch, t]);

  const notice = useMemo(
    () =>
      models.notice === "tmdbOff"
        ? { kind: "disabled" as const, text: `${t("reco:tmdbOffText")} ${t("reco:tmdbOffDeviceHint")}` }
        : models.notice === "disabled"
        ? { kind: "disabled" as const, text: t("reco:tvDisabledHint") }
        : models.notice === "cold"
          ? { kind: "cold" as const, text: t("reco:tvColdHint") }
          : null,
    [models.notice, t],
  );

  const firstShelf = models.shelves[0];
  const entryKey = forYouEntryKey({ status: status ? { withAction: !!status.primary } : null, hasHero: hero !== null, firstShelfKey: firstShelf?.key ?? null });
  // Ses étagères reviennent au début : hors de l'écran, et par Retour.
  const screen = useRedesignScreen({ railKey: "Recommendations", entryKey, rewindRows: true });
  const { ambient, onFocusCard } = useAmbientPalette(screen.focus);
  // HAUT depuis la 1re carte de la 1re étagère : la puce du filtre, où qu'elle soit (décision du 17/10).
  useSectionHead(screen.focus, firstShelf ? `section:${firstShelf.key}` : null, filter ? FOR_YOU_FILTER_KEY : null);

  const detail = useCallback((itemId: string) => navigation.navigate("MediaDetail", { itemId }), [navigation]);
  const cardActions = useTVCardActions();
  const { openReco } = cardActions;
  // Des gestes stables qui lisent l'état du moment.
  const live = useRef({ heroItem, heroReco: models.heroReco });
  live.current = { heroItem, heroReco: models.heroReco };
  // OK sur la bannière : la fiche (tv-core `cardPress`, surface « hero ») — la
  // tête de « Pour vous » est toujours un titre de la bibliothèque.
  const onHeroPrimary = useCallback(() => {
    const item = live.current.heroItem;
    if (item && cardPressOf({ surface: "hero", fromResume: false, reco: true }) === "detail") detail(item.Id);
  }, [detail]);
  // OK maintenu : le grand panneau d'une recommandation (tv-core `cardHold`).
  const onHeroLongPress = useCallback(() => {
    const reco = live.current.heroReco;
    if (reco && holdPanelOf({ surface: "hero", fromResume: false, reco: true })?.kind === "reco") openReco(reco);
  }, [openReco]);

  const { targetOf } = models;
  const openRequest = requests?.open;
  const holdRequest = requests?.hold;
  const onPressCard = useCallback(
    (shelfKey: string, card: CardModel) => {
      const target = targetOf(shelfKey, card.id);
      if (!target) return;
      // OK : la fiche de son item, ou la demande d'un titre absent (tv-core `cards/cardPress`).
      const press = cardPressOf({ surface: "forYou", absent: target.absent !== undefined });
      if (press === "detail" && target.item) detail(target.item.Id);
      else if (press === "request" && target.absent) openRequest?.(target.absent);
    },
    [targetOf, detail, openRequest],
  );
  const dismiss = useCallback(
    (title: AbsentTitle) => sendFeedback({ itemKey: title.key, action: "dismissed" }),
    [sendFeedback],
  );
  const onLongPressCard = useCallback(
    (shelfKey: string, card: CardModel) => {
      const target = targetOf(shelfKey, card.id);
      if (!target) return;
      // Le panneau d'une reco, ou celui d'un titre absent qui garde le refus (tv-core `cards/cardHold`).
      const panel = holdPanelOf({ surface: "forYou", absent: target.absent !== undefined });
      if (panel?.kind === "reco") openReco(target.reco);
      else if (panel?.kind === "absent" && target.absent) holdRequest?.(target.absent, panel.dismiss ? { onDismiss: dismiss } : undefined);
    },
    [targetOf, openReco, holdRequest, dismiss],
  );

  // La lumière quand aucune carte n'impose la sienne (`ambient`, que le fond suit seul).
  const palette = hero?.palette ?? firstShelf?.cards[0]?.palette ?? NEUTRAL_PALETTE;

  return (
    <RedesignScreen screen={screen}>
      <ForYouView
        nav={screen.nav}
        hero={hero}
        notice={notice}
        shelves={models.shelves}
        filter={filter}
        palette={palette}
        ambient={ambient}
        status={status}
        onHeroPrimary={onHeroPrimary}
        onHeroLongPress={onHeroLongPress}
        onRemoveFilter={removeFilter}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
      />
      {cardActions.sheet}
      {requests?.overlay}
    </RedesignScreen>
  );
}
