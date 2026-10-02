import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { DetailView } from "../../redesign/screens/detail/DetailView";
import { useBackFocus } from "../focus/backFocus";
import { useFocusStore } from "../focus/focusStore";
import { useEntryFocus } from "../screen/useEntryFocus";
import { ActionSheetRedesign } from "../sheet/ActionSheetRedesign";
import { useTitleRequests } from "../vigie/useTitleRequests";
import { useSeriesGapTabs } from "../vigie/useSeriesGapTabs";
import { useDetailActions } from "./useDetailActions";
import { useDetailGuides } from "./useDetailGuides";
import { useDetailModel, type DetailModel } from "./useDetailModel";

type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

/**
 * La fiche refondue (Apple TV) : `DetailView` sur les hooks de la fiche
 * actuelle — film, série, épisode, collection.
 *
 * Le focus, par le magasin de l'écran (`useFocusStore`) :
 * - l'ENTRÉE sur Lecture (sinon la bande-annonce, sinon Ma liste), et
 *   « Réessayer » sur une fiche en erreur (`useEntryFocus`) — JAMAIS sur la
 *   croix Retour, en haut à gauche : verrouillée jusqu'à ce que l'entrée ait
 *   le focus, puis atteinte par HAUT depuis l'en-tête (`useBackFocus`) ;
 * - le RETOUR du lecteur, de la bande-annonce ou d'une autre fiche rend le
 *   focus au dernier élément qui l'avait ;
 * - HAUT / BAS d'une section à l'autre par la règle commune, et ses deux
 *   exceptions : la saison affichée, l'épisode à reprendre (`useDetailGuides`) ;
 * - une série qui se révèle terminée perd sa pilule de lecture : si elle
 *   avait le focus, il passe à l'action suivante.
 * Une série incomplète montre ses saisons manquantes en onglets GRISÉS au bout
 * de la bande (`useSeriesGapTabs`, garde Vigie ouverte) : OK sur un « + »
 * demande cette saison, et l'onglet prend son état sans que le focus bouge.
 * Menu dépile l'écran (pile native) ; les feuilles le reçoivent elles-mêmes.
 */

/** La croix Retour de la fiche (`DetailView`). */
const DETAIL_BACK_KEY = "detail:back";

function entryKeyOf({ props }: DetailModel): string | null {
  if (props.error) return "status:primary";
  const actions = props.actions;
  if (!props.header || !actions) return null;
  if (actions.play) return "detail:primary";
  return actions.trailer ? "detail:trailer" : "detail:list";
}

export function MediaDetailRedesign({ route }: Props) {
  // Demander un volet absent de la saga, une saison manquante — rien tant que la garde Vigie est fermée.
  const requests = useTitleRequests();
  const model = useDetailModel(route.params.itemId, requests?.gate ?? null);
  const { item } = model;
  const gapTabs = useSeriesGapTabs(requests, item);
  const shown = model.props.episodes;
  const episodes = useMemo(
    () => (shown && gapTabs.missing ? { ...shown, missing: gapTabs.missing } : shown),
    [shown, gapTabs.missing],
  );
  const cardActions = useTVCardActions();
  const [rating, setRating] = useState(false);
  const openRating = useCallback(() => setRating(true), []);
  const closeRating = useCallback(() => setRating(false), []);
  const callbacks = useDetailActions({
    model,
    openLandscapeSheet: cardActions.openLandscape,
    openPosterSheet: cardActions.openPoster,
    openRating,
    cardItemOf: model.cards.itemOf,
    requests,
  });

  const focus = useFocusStore();
  const entryKey = entryKeyOf(model);
  useEntryFocus(focus, entryKey);
  useBackFocus(focus, { backKey: DETAIL_BACK_KEY, barKey: "detail:top", entryKey });
  useDetailGuides(focus, model.props.episodes);

  // La pilule de lecture qui disparaît sous le focus (série terminée, apprise
  // après l'arrivée) ne laisse pas l'écran sans focus.
  const hasPlay = !!model.props.actions?.play;
  const hadPlay = useRef(hasPlay);
  useEffect(() => {
    const lost = hadPlay.current && !hasPlay;
    hadPlay.current = hasPlay;
    if (lost && focus.lastFocusedKey() === "detail:primary" && entryKey) return focus.claim(entryKey);
    return undefined;
  }, [hasPlay, entryKey, focus]);

  // « Noter » : la note seule. La note d'un épisode est la sienne (vignette),
  // celle d'un film, d'une série ou d'une collection l'affiche.
  const ratingTarget = useMemo<CardSheetTarget | null>(
    () => (item ? { kind: "media", item, variant: item.Type === "Episode" ? "landscape" : "poster" } : null),
    [item],
  );

  return (
    <FocusBindingProvider bind={focus.binder}>
      <DetailView {...model.props} episodes={episodes} {...callbacks} onRequestSeason={gapTabs.onRequestSeason} />
      {model.extras.probes}
      {cardActions.sheet}
      {requests?.overlay}
      {rating && ratingTarget ? <ActionSheetRedesign target={ratingTarget} mode="rate" onClose={closeRating} /> : null}
    </FocusBindingProvider>
  );
}
