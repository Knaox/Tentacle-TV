import { useCallback, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  recoMarkerItem,
  useCardRatingTarget,
  useCardToggles,
  useDeleteRating,
  useMediaItem,
  useRateItem,
  useResolvePlayTarget,
  useSaveRecoProviderFilter,
  useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import {
  resolveCardOverlay,
  type CardOverlay,
  type CardOverlayVariant,
  type CardToggleStates,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { RootStackParamList } from "../../navigation/types";
import { sheetLibraryId, sheetVariant, type CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { useCardSheetPlay, type CardSheetPlay } from "../../components/cards/actions/useCardSheetPlay";
import { useTVUserScore } from "../../components/cards/actions/useTVUserScore";
import type { SheetActionKind } from "../../redesign/screens/sheet/ActionSheetView";

/**
 * Les actions d'UNE carte, pour le grand panneau de l'appui long
 * (`useSheetModel`) — sur Apple TV, la carte n'en porte aucune. Le modèle
 * partagé du survol (`resolveCardOverlay`) décide de ce qui est offert,
 * `useCardToggles` des bascules, `useCardSheetPlay` de la lecture,
 * `useCardRatingTarget` et `useTVUserScore` de la note. Le panneau en tire
 * ses pictos par `cardActionEntries` (la lecture toujours en tête : le
 * panneau remplace la carte).
 */

export interface CardActionsOptions {
  /** Faux : la note seule (« Noter » de la fiche) — la lecture ne se résout pas. */
  withActions?: boolean;
  /** Un geste qui QUITTE la carte (lire, la fiche, le refus, le filtre) : le
   *  panneau se ferme d'abord. */
  onLeave?: () => void;
}

export interface CardActions {
  variant: CardOverlayVariant;
  overlay: CardOverlay;
  states: CardToggleStates;
  play: CardSheetPlay | null;
  /** La note posée (sur 10) ; `pending` tant que sa cible ou la liste des
   *  notes se résolvent ; null : rien à noter. */
  rating: { current: number | null; pending: boolean } | null;
  onAction: (kind: SheetActionKind) => void;
  /** Pose la note (1 à 10, demi-étoiles comprises) ; `null` la retire. */
  onRate: (score: number | null) => void;
}

export function useCardActions(target: CardSheetTarget, { withActions = true, onLeave }: CardActionsOptions = {}): CardActions {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const variant = sheetVariant(target);
  const libraryId = sheetLibraryId(target);
  const inLibrary = libraryId !== null;

  // La fiche COMPLÈTE, sur la clé de l'écran de détail : un `UserData` que les
  // bascules patchent sous les yeux, les `ProviderIds` de la note. En
  // attendant, le visage de la carte suffit — sauf pour la note : une carte de
  // grille n'a pas ses `ProviderIds`, et sa cible de note n'est pas encore SUE.
  const { data: full, isLoading: fullLoading } = useMediaItem(libraryId ?? undefined);
  const face = useMemo<MediaItem>(
    () => full ?? (target.kind === "reco" ? recoMarkerItem(target.item) : target.item),
    [full, target],
  );

  const play = useCardSheetPlay(inLibrary && withActions ? face : null);
  const toggles = useCardToggles(face);
  const rating = useCardRatingTarget(face, { scope: variant === "landscape" ? "item" : "series", enabled: true });
  // `undefined` tant que la liste des notes n'est pas là : l'échelle attend.
  const score = useTVUserScore(rating.identity);
  const { mutate: rateItem } = useRateItem();
  const { mutate: removeRating } = useDeleteRating();
  const resolvePlay = useResolvePlayTarget();
  const { mutate: sendFeedback } = useSendRecoFeedback();
  const { mutate: saveFilter } = useSaveRecoProviderFilter();

  // « Pas encore su » (la fiche complète en route) n'est pas « non notable » :
  // la note reste en attente — le panneau n'entre pas avant de savoir.
  const ratingUnknown = inLibrary && full === undefined && fullLoading;
  const rateable = rating.identity !== null || rating.pending || ratingUnknown;
  const overlay = resolveCardOverlay({
    variant,
    inLibrary,
    playable: play !== null,
    resume: play?.resume,
    rateable,
    // Rien ne se garde hors ligne sur un téléviseur.
    offline: false,
  });

  const startPlay = useCallback(async () => {
    // L'épisode d'une série encore en résolution : le geste le résout, sur la
    // même clé de cache ; rien à lire (série terminée entre-temps) → la fiche.
    const itemId = play?.itemId ?? (await resolvePlay(face));
    onLeave?.();
    if (itemId) navigation.navigate("Player", { itemId });
    else navigation.push("MediaDetail", { itemId: face.Id });
  }, [play?.itemId, resolvePlay, face, onLeave, navigation]);

  const { toggle } = toggles;
  const onAction = useCallback(
    (kind: SheetActionKind) => {
      switch (kind) {
        case "play":
          void startPlay();
          return;
        case "watchlist":
        case "favorite":
        case "watched":
          // Les bascules restent sur place : leurs libellés et glyphes basculent sous les yeux.
          toggle(kind);
          return;
        case "details":
          onLeave?.();
          navigation.push("MediaDetail", { itemId: face.Id });
          return;
        case "dismiss":
          if (target.kind === "reco") sendFeedback({ itemKey: target.item.key, action: "dismissed" });
          onLeave?.();
          return;
        case "providersAll":
          onLeave?.();
          saveFilter([]);
          return;
        default:
          // « Garder hors ligne », « Demander » : rien de tel sur un téléviseur.
          return;
      }
    },
    [target, startPlay, toggle, onLeave, navigation, face.Id, sendFeedback, saveFilter],
  );

  const { identity, jellyfinItemId } = rating;
  const onRate = useCallback(
    (next: number | null) => {
      if (!identity) return;
      if (next === null) {
        removeRating(identity);
        return;
      }
      // Hors bibliothèque, la note vit sur le tmdb : un visage `reco:…` n'est
      // pas un item Jellyfin à qui la rattacher.
      rateItem({ ...identity, jellyfinItemId: inLibrary ? jellyfinItemId ?? undefined : undefined, score: next });
    },
    [identity, jellyfinItemId, inLibrary, rateItem, removeRating],
  );

  return {
    variant,
    overlay,
    states: toggles.states,
    play,
    rating: rateable ? { current: score ?? null, pending: identity === null || score === undefined } : null,
    onAction,
    onRate,
  };
}
