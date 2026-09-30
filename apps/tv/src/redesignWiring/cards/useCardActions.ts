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
 * Les actions d'UNE carte, résolues une seule fois pour ses deux entrées : la
 * feuille de l'appui long (`useSheetModel`) et le plateau du focus
 * (`useCardTrayHost`). Le modèle partagé du survol (`resolveCardOverlay`)
 * décide de ce qui est offert, `useCardToggles` des bascules,
 * `useCardSheetPlay` de la lecture, `useCardRatingTarget` et `useTVUserScore`
 * de la note ; les gestes sont ceux de la feuille. Chaque entrée en tire ses
 * lignes : `cardActionEntries` (la lecture toujours en tête — la feuille
 * remplace la carte), `cardTrayEntries` (la lecture là seulement où OK ne lit
 * pas).
 *
 * `target` nul — aucune carte n'a le focus — : rien n'est rendu (`null`), et
 * rien ne part au serveur ; les crochets restent appelés, dans le même ordre.
 */

export interface CardActionsOptions {
  /** Faux : la note seule (« Noter » de la fiche) — la lecture ne se résout pas. */
  withActions?: boolean;
  /** Un geste qui QUITTE la carte (lire, la fiche, le refus, le filtre) : la
   *  feuille se ferme d'abord. Le plateau n'a rien à fermer. */
  onLeave?: () => void;
}

export interface CardActions {
  variant: CardOverlayVariant;
  overlay: CardOverlay;
  states: CardToggleStates;
  play: CardSheetPlay | null;
  /** La note posée (sur 10) et sa cible encore en résolution ; null : rien à noter. */
  rating: { current: number | null; pending: boolean } | null;
  onAction: (kind: SheetActionKind) => void;
  /** Pose la note (1 à 10, demi-étoiles comprises) ; `null` la retire. */
  onRate: (score: number | null) => void;
}

/** Le visage d'aucune carte : les crochets tournent à vide, dans le même ordre. */
const NO_FACE = { Id: "", Name: "", Type: "Movie" } as MediaItem;

export function useCardActions(target: CardSheetTarget, options?: CardActionsOptions): CardActions;
export function useCardActions(target: CardSheetTarget | null, options?: CardActionsOptions): CardActions | null;
export function useCardActions(target: CardSheetTarget | null, { withActions = true, onLeave }: CardActionsOptions = {}): CardActions | null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const variant: CardOverlayVariant = target ? sheetVariant(target) : "poster";
  const libraryId = target ? sheetLibraryId(target) : null;
  const inLibrary = libraryId !== null;

  // La fiche COMPLÈTE, sur la clé de l'écran de détail : un `UserData` que les
  // bascules patchent sous les yeux, les `ProviderIds` de la note. En
  // attendant, le visage de la carte suffit.
  const { data: full } = useMediaItem(libraryId ?? undefined);
  const face = useMemo<MediaItem>(
    () => (!target ? NO_FACE : full ?? (target.kind === "reco" ? recoMarkerItem(target.item) : target.item)),
    [full, target],
  );

  const play = useCardSheetPlay(target && inLibrary && withActions ? face : null);
  const toggles = useCardToggles(face);
  const rating = useCardRatingTarget(target ? face : null, { scope: variant === "landscape" ? "item" : "series", enabled: target !== null });
  const score = useTVUserScore(rating.identity) ?? null;
  const { mutate: rateItem } = useRateItem();
  const { mutate: removeRating } = useDeleteRating();
  const resolvePlay = useResolvePlayTarget();
  const { mutate: sendFeedback } = useSendRecoFeedback();
  const { mutate: saveFilter } = useSaveRecoProviderFilter();

  const rateable = rating.identity !== null || rating.pending;
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
      if (!target) return;
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
        case "rate":
          // L'échelle s'ouvre DANS la feuille : c'est son câblage qui la montre.
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

  if (!target) return null;
  return {
    variant,
    overlay,
    states: toggles.states,
    play,
    rating: rateable ? { current: score, pending: identity === null } : null,
    onAction,
    onRate,
  };
}
