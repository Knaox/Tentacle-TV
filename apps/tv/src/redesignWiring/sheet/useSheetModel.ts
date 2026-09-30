import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  recoMarkerItem,
  useCardRatingTarget,
  useCardToggles,
  useDeleteRating,
  useJellyfinClient,
  useMediaItem,
  useRateItem,
  useResolvePlayTarget,
  useSaveRecoProviderFilter,
  useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import { cardActionEntries, resolveCardOverlay, type MediaItem } from "@tentacle-tv/shared";
import type { RootStackParamList } from "../../navigation/types";
import { sheetLibraryId, sheetVariant, type CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { useCardSheetPlay } from "../../components/cards/actions/useCardSheetPlay";
import { useTVUserScore } from "../../components/cards/actions/useTVUserScore";
import type {
  ActionSheetViewProps,
  SheetActionKind,
  SheetActionModel,
  SheetRatingModel,
} from "../../redesign/screens/sheet/ActionSheetView";
import { mediaSheetHeader, recoSheetHeader } from "./sheetHeader";

/**
 * Ce que la feuille refondue reçoit, résolu comme sur toutes les plateformes :
 * le modèle partagé du survol (`resolveCardOverlay` → `cardActionEntries`)
 * décide des lignes et de leur ordre, `useCardToggles` des bascules,
 * `useCardSheetPlay` du complément de la lecture, `useCardRatingTarget` de ce
 * que notent les étoiles. Les gestes sont ceux de l'ancienne feuille : les
 * bascules et la note la laissent ouverte (les libellés basculent sous les
 * yeux) ; lire, la fiche, le refus et le filtre la ferment.
 *
 * `rate` : la même feuille réduite à ses étoiles — le bouton « Noter » de la
 * fiche, qui a déjà ses propres boutons de lecture et de bascule.
 */

export type SheetMode = "actions" | "rate";

export interface SheetModelInput {
  target: CardSheetTarget;
  mode: SheetMode;
  /** Un filtre de plateformes est actif : « Toutes les plateformes » suit (recommandations). */
  providerFilterActive: boolean;
  onClose: () => void;
}

export function useSheetModel({ target, mode, providerFilterActive, onClose }: SheetModelInput): ActionSheetViewProps {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const variant = sheetVariant(target);
  const libraryId = sheetLibraryId(target);
  const inLibrary = libraryId !== null;
  const actionsShown = mode === "actions";

  // La fiche COMPLÈTE, sur la clé de l'écran de détail : un `UserData` que les
  // bascules patchent sous les yeux, les `ProviderIds` de la note.
  const { data: full } = useMediaItem(libraryId ?? undefined);
  const face = useMemo<MediaItem>(
    () => full ?? (target.kind === "reco" ? recoMarkerItem(target.item) : target.item),
    [full, target],
  );

  const play = useCardSheetPlay(inLibrary && actionsShown ? face : null);
  const toggles = useCardToggles(face);
  const rating = useCardRatingTarget(face, { scope: variant === "landscape" ? "item" : "series", enabled: true });
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

  const header = useMemo(
    () => (target.kind === "reco" ? recoSheetHeader(client, target.item) : mediaSheetHeader(client, target.item, target.variant, t)),
    [client, target, t],
  );

  const actions: SheetActionModel[] = actionsShown
    ? cardActionEntries(overlay, toggles.states).map((entry) => ({
        kind: entry.kind,
        label: t(`cards:${entry.labelKey}`),
        active: entry.active,
        detail: entry.kind === "play" ? play?.detail : null,
      }))
    : [];
  if (actionsShown && variant === "reco" && providerFilterActive) {
    actions.push({ kind: "providersAll", label: t("reco:providersAll") });
  }

  const ratingModel: SheetRatingModel | null =
    rateable && (overlay.rate || !actionsShown) ? { current: score, pending: rating.identity === null } : null;

  const startPlay = useCallback(async () => {
    // L'épisode d'une série encore en résolution : le geste le résout, sur la
    // même clé de cache ; rien à lire (série terminée entre-temps) → la fiche.
    const itemId = play?.itemId ?? (await resolvePlay(face));
    onClose();
    if (itemId) navigation.navigate("Player", { itemId });
    else navigation.push("MediaDetail", { itemId: face.Id });
  }, [play?.itemId, resolvePlay, face, onClose, navigation]);

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
          toggle(kind);
          return;
        case "details":
          onClose();
          navigation.push("MediaDetail", { itemId: face.Id });
          return;
        case "dismiss":
          if (target.kind === "reco") sendFeedback({ itemKey: target.item.key, action: "dismissed" });
          onClose();
          return;
        case "providersAll":
          onClose();
          saveFilter([]);
          return;
        default:
          // « Garder hors ligne », « Demander » : rien de tel sur un téléviseur.
          return;
      }
    },
    [startPlay, toggle, onClose, navigation, face.Id, target, sendFeedback, saveFilter],
  );

  // Une étoile = 2 sur 10 ; la note actuelle, visée de nouveau, se retire.
  const { identity, jellyfinItemId } = rating;
  const onRate = useCallback(
    (stars: number) => {
      if (!identity) return;
      const next = stars * 2;
      if (score === next) removeRating(identity);
      // Hors bibliothèque, la note vit sur le tmdb : un visage `reco:…` n'est
      // pas un item Jellyfin à qui la rattacher.
      else rateItem({ ...identity, jellyfinItemId: inLibrary ? jellyfinItemId ?? undefined : undefined, score: next });
    },
    [identity, jellyfinItemId, inLibrary, score, rateItem, removeRating],
  );

  return { header, actions, rating: ratingModel, onAction, onRate, onClose };
}
