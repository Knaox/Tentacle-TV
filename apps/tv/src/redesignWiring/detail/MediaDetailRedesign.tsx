import { useCallback, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { detailEntryKey, rateTargetVariant } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useDetailFocus } from "../../platform/tvos/screens/detail";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { DetailView } from "../../redesign/screens/detail/DetailView";
import { ActionSheetRedesign } from "../sheet/ActionSheetRedesign";
import { useTitleRequests } from "../vigie/useTitleRequests";
import { useSeriesGapTabs } from "../vigie/useSeriesGapTabs";
import { useDetailActions } from "./useDetailActions";
import { usePerfReady } from "../../platform/perf";
import { useDetailModel, type DetailModel } from "./useDetailModel";

type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

/**
 * La fiche refondue (Apple TV) : `DetailView` sur les hooks de la fiche
 * actuelle — film, série, épisode, collection.
 *
 * Le focus — décidé par tv-core (`focus/detailFocus.ts`), posé par
 * l'applicateur tvOS (`platform/tvos/screens/detail.ts`) : l'entrée sur
 * Lecture (sinon la bande-annonce, sinon Ma liste), « Réessayer » en erreur,
 * jamais la croix Retour ; le retour du lecteur, de la bande-annonce ou d'une
 * autre fiche sur le dernier élément ; HAUT / BAS par la règle commune et ses
 * deux exceptions (la saison affichée, l'épisode à reprendre) ; la pilule de
 * lecture perdue sous le focus rend la main à l'entrée suivante.
 * Une série incomplète montre ses saisons manquantes en onglets GRISÉS au bout
 * de la bande (`useSeriesGapTabs`, garde Vigie ouverte) : OK sur un « + »
 * demande cette saison, et l'onglet prend son état sans que le focus bouge.
 * Menu dépile l'écran (pile native) ; les feuilles le reçoivent elles-mêmes.
 */

/** L'entrée de la fiche : l'état de la vue, mis dans les mots de la règle. */
function entryKeyOf({ props }: DetailModel): string | null {
  const actions = props.actions;
  return detailEntryKey({
    error: !!props.error,
    ready: !!props.header && !!actions,
    play: !!actions?.play,
    trailer: !!actions?.trailer,
  });
}

export function MediaDetailRedesign({ route }: Props) {
  // Demander un volet absent de la saga, une saison manquante — rien tant que la garde Vigie est fermée.
  const requests = useTitleRequests();
  const model = useDetailModel(route.params.itemId, requests?.gate ?? null, route.params.seasonId);
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
  // Le mode de mesure (Android TV, éteint par défaut) : la fiche est prête.
  usePerfReady("fiche", !!model.props.header && !!model.props.actions);
  useDetailFocus(focus, {
    entryKey: entryKeyOf(model),
    seasonIds: shown?.seasons.map((season) => season.id) ?? [],
    selectedSeasonId: shown?.selectedSeasonId,
    episodeCount: shown?.episodes?.length ?? 0,
    anchorIndex: shown?.anchorIndex,
    hasPlay: !!model.props.actions?.play,
  });

  // « Noter » : la note seule. La note d'un épisode est la sienne (vignette),
  // celle d'un film, d'une série ou d'une collection l'affiche.
  const ratingTarget = useMemo<CardSheetTarget | null>(
    () => (item ? { kind: "media", item, variant: rateTargetVariant(item.Type ?? "") } : null),
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
