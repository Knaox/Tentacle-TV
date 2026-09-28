import { useCallback, useMemo } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  recoMarkerItem,
  useCardRatingTarget,
  useCardToggles,
  useMediaItem,
  useResolvePlayTarget,
  useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import {
  BRAND,
  cardActionEntries,
  resolveCardOverlay,
  type CardActionEntry,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { RootStackParamList } from "../../../navigation/types";
import { InfoIcon, PlayIcon } from "../../icons/TVIcons";
import { TVToggleGlyph } from "../tvCardGlyphs";
import { EyeOffIcon } from "./sheetIcons";
import { TVCardSheetButton } from "./TVCardSheetButton";
import { TVCardSheetHeader } from "./TVCardSheetHeader";
import { TVCardSheetRating } from "./TVCardSheetRating";
import { TVRecoSheetExtras } from "./TVRecoSheetExtras";
import { useCardSheetPlay } from "./useCardSheetPlay";
import { sheetLibraryId, sheetVariant, type CardSheetTarget } from "./cardSheetTarget";
import { Colors, Radius } from "../../../theme/colors";

interface TVCardActionSheetProps {
  target: CardSheetTarget;
  onClose: () => void;
}

/**
 * LA feuille d'actions des cartes du salon — l'appui long (OK maintenu) sur
 * n'importe quelle carte, tvOS et Android TV confondus. Le focus tient lieu
 * de survol ; l'appui long ouvre ce que le survol web offre, dans le même
 * ordre, décidé par le modèle partagé (`resolveCardOverlay`,
 * `cardActionEntries`) : Lire / Reprendre, Ma liste, favori, vu, puis les
 * extras (« Plus d'infos » d'une vignette dont OK lance la lecture, « Ne plus
 * me proposer » d'une recommandation), puis la note en étoiles.
 *
 * Une `Modal` de React Native : le focus y est PIÉGÉ sur les deux plateformes
 * (contrôleur présenté sur tvOS, fenêtre de dialogue sur Android), et
 * `onRequestClose` reçoit le bouton Menu de la Siri Remote comme le Retour
 * d'Android — le seul chemin par lequel le Menu atteint le JS sans
 * `usePreventRemove` (cf. `RCTModalHostView`, `menuButtonPressed`).
 *
 * Les bascules et la note laissent la feuille ouverte : leur libellé et leurs
 * glyphes basculent sous les yeux. Lire, la fiche et le refus la ferment.
 */
export function TVCardActionSheet({ target, onClose }: TVCardActionSheetProps) {
  const { t } = useTranslation("cards");
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const variant = sheetVariant(target);
  const libraryId = sheetLibraryId(target);
  const inLibrary = libraryId !== null;

  // La fiche COMPLÈTE, sur la clé de l'écran de détail : un `UserData` que
  // les bascules patchent sous les yeux, les `ProviderIds` de la note (un
  // résultat de recherche n'en porte pas). Une requête par appui long, que la
  // fiche retrouve en cache si l'on y va ensuite.
  const { data: full } = useMediaItem(libraryId ?? undefined);
  const face = useMemo<MediaItem>(
    () => full ?? (target.kind === "reco" ? recoMarkerItem(target.item) : target.item),
    [full, target],
  );

  const play = useCardSheetPlay(inLibrary ? face : null);
  const toggles = useCardToggles(face);
  const rating = useCardRatingTarget(face, { scope: variant === "landscape" ? "item" : "series", enabled: true });
  const resolvePlay = useResolvePlayTarget();
  const feedback = useSendRecoFeedback();

  const overlay = resolveCardOverlay({
    variant,
    inLibrary,
    playable: play !== null,
    resume: play?.resume,
    rateable: rating.identity !== null || rating.pending,
    // Rien ne se garde hors ligne sur un téléviseur.
    offline: false,
  });
  const entries = cardActionEntries(overlay, toggles.states);

  const openDetails = useCallback(() => {
    onClose();
    navigation.push("MediaDetail", { itemId: face.Id });
  }, [onClose, navigation, face.Id]);

  const startPlay = useCallback(async () => {
    // L'épisode d'une série encore en résolution : le geste le résout, sur la
    // même clé de cache ; rien à lire (série terminée entre-temps) → la fiche.
    const itemId = play?.itemId ?? (await resolvePlay(face));
    onClose();
    if (itemId) navigation.navigate("Player", { itemId });
    else navigation.push("MediaDetail", { itemId: face.Id });
  }, [play?.itemId, resolvePlay, face, onClose, navigation]);

  const run = useCallback((entry: CardActionEntry) => {
    switch (entry.kind) {
      case "play":
        void startPlay();
        return;
      case "watchlist":
      case "favorite":
      case "watched":
        toggles.toggle(entry.kind);
        return;
      case "details":
        openDetails();
        return;
      case "dismiss":
        if (target.kind === "reco") feedback.mutate({ itemKey: target.item.key, action: "dismissed" });
        onClose();
        return;
      case "offline":
        return;
    }
  }, [startPlay, toggles, openDetails, target, feedback, onClose]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel}>
          <TVCardSheetHeader target={target} onClose={onClose} />
          <View style={styles.actions}>
            {entries.map((entry, index) => (
              <TVCardSheetButton
                key={entry.kind}
                icon={<EntryIcon entry={entry} />}
                label={t(entry.labelKey)}
                detail={entry.kind === "play" ? play?.detail : null}
                primary={entry.kind === "play"}
                preferred={index === 0}
                onPress={() => run(entry)}
                testID={`card-sheet-${entry.kind}`}
              />
            ))}
            {target.kind === "reco" && <TVRecoSheetExtras onDone={onClose} />}
          </View>
          {overlay.rate && (
            <View style={styles.rating}>
              <TVCardSheetRating
                identity={rating.identity}
                // Hors bibliothèque, la note vit sur le tmdb : le visage `reco:…`
                // n'est pas un item Jellyfin à qui la rattacher.
                jellyfinItemId={inLibrary ? rating.jellyfinItemId : null}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Le glyphe d'une action : ceux de la pastille d'états pour les bascules —
 *  pleins quand c'est fait, au trait sinon —, le cœur au rose de marque. */
function EntryIcon({ entry }: { entry: CardActionEntry }) {
  switch (entry.kind) {
    case "play":
      return <PlayIcon size={22} color="#FFFFFF" />;
    case "watchlist":
    case "favorite":
    case "watched": {
      const active = entry.active === true;
      const color = entry.kind === "favorite" && active ? BRAND.accent : "#FFFFFF";
      return <TVToggleGlyph kind={entry.kind} size={24} color={color} filled={active} />;
    }
    case "details":
      return <InfoIcon size={24} color="#FFFFFF" />;
    case "dismiss":
      return <EyeOffIcon size={24} color="#FFFFFF" />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    width: 620,
    padding: 32,
    gap: 26,
    borderRadius: Radius.modal,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    // Fond à 0,92 d'alpha : un flou derrière ne se verrait pas (cf. CLAUDE.md,
    // « Coût GPU »), il n'y en a donc pas.
    backgroundColor: Colors.glassBgHeavy,
  },
  actions: { gap: 10 },
  rating: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 14,
  },
});
