import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCardRatingTarget, useMediaItem, useSendRecoFeedback, type RatingIdentity } from "@tentacle-tv/api-client";
import { resolveCardOverlay } from "@tentacle-tv/shared";
import { RecoReasonList } from "@/components/reco/RecoReasonList";
import { RatingPanelMobile } from "@/components/rating/RatingPanelMobile";
import type { CardSheetNavigation } from "@/components/cards/sheet/cardSheetContext";
import type { CardSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { SheetActionGrid } from "@/components/cards/sheet/SheetActionGrid";
import { SheetFrame } from "@/components/cards/sheet/SheetFrame";
import { SheetHeader } from "@/components/cards/sheet/SheetHeader";
import { SheetPlayButton } from "@/components/cards/sheet/SheetPlayButton";
import { useSheetPlay } from "@/components/cards/sheet/useSheetPlay";
import { spacing } from "@/theme";

interface Props {
  /** La carte appuyée — `null` : feuille fermée. */
  target: CardSheetTarget | null;
  onClose: () => void;
  /** Où mènent Lire et Plus d'infos (la recherche, modale) ; empiler sinon. */
  navigation?: CardSheetNavigation;
}

/**
 * LA feuille d'appui long des cartes — l'équivalent tactile du survol web
 * (`CardHoverOverlay`) : les mêmes actions, tirées du modèle partagé
 * (`resolveCardOverlay`), dans l'ordre d'une feuille (`cardActionEntries`).
 * Une seule feuille pour toutes les cartes : affiches, vignettes 16:9, lignes
 * d'épisode, recommandations en bibliothèque ou non.
 *
 *   1. l'en-tête (et « Pourquoi ce titre » pour une recommandation) ;
 *   2. Lire / Reprendre — le bouton central du survol, quand quelque chose se
 *      lance (une série : son épisode à reprendre ou à suivre) ;
 *   3. les bascules, dans l'ordre de la pastille d'états : Ma liste, favori,
 *      vu — Ma liste et favori au niveau SÉRIE, « vu » sur le titre montré ;
 *   4. les extras : garder hors ligne, Plus d'infos (carte dont le tap lance
 *      la lecture), Ne plus me proposer (recommandation) ;
 *   5. les étoiles — la série pour une affiche d'épisode, l'épisode pour une
 *      vignette, le tmdb pour un titre hors bibliothèque.
 */
export function MediaActionSheet({ target, onClose, navigation }: Props) {
  if (!target) return null;
  return <CardSheet target={target} onClose={onClose} navigation={navigation} />;
}

function CardSheet({ target, onClose, navigation }: { target: CardSheetTarget; onClose: () => void; navigation?: CardSheetNavigation }) {
  const { t } = useTranslation("cards");
  const router = useRouter();
  const feedback = useSendRecoFeedback();
  // La fiche complète : état frais (UserData), et patchée par les mutations
  // optimistes — la feuille suit ses bascules. Le visage de la carte tient la
  // place le temps qu'elle arrive (une recherche ne rend qu'un item réduit).
  const { data: fetched } = useMediaItem(target.item?.Id);
  const item = target.item ? (fetched ?? target.item) : null;
  const play = useSheetPlay(item);

  // Hors bibliothèque, la note vit sur le tmdb : il n'y a pas d'item Jellyfin
  // à qui la rattacher (cf. `RecoPosterHoverLayer` web).
  const reco = target.reco;
  const tmdbIdentity = useMemo<RatingIdentity | null>(
    () => (reco && !reco.jellyfinItemId ? { mediaType: reco.mediaType === "tv" ? "series" : "movie", tmdbId: reco.tmdbId } : null),
    [reco],
  );
  const ratingTarget = useCardRatingTarget(tmdbIdentity ? null : item, {
    scope: target.variant === "landscape" ? "item" : "series",
    enabled: true,
  });
  const identity = tmdbIdentity ?? ratingTarget.identity;

  const overlay = resolveCardOverlay({
    variant: target.variant,
    inLibrary: item !== null,
    playable: play !== null,
    resume: play?.resume,
    rateable: identity !== null || ratingTarget.pending,
    // Le mobile garde hors ligne ; la cellule se tait d'elle-même quand le
    // titre ne s'y prête pas (droits, collection).
    offline: true,
  });

  const go: CardSheetNavigation = navigation ?? {
    play: (id) => router.push(`/watch/${id}`),
    open: (id) => router.push(`/media/${id}`),
  };

  return (
    <SheetFrame onClose={onClose}>
      {({ dismiss, leave }) => (
        <>
          <SheetHeader target={target} item={item} />
          {reco && reco.reasons.length > 0 && (
            <View style={st.reasons}>
              <RecoReasonList reasons={reco.reasons} />
            </View>
          )}
          {overlay.play && play && item && (
            <SheetPlayButton
              label={t(overlay.play.labelKey)}
              episodeCode={play.episodeCode}
              title={target.title}
              pending={play.pending}
              onPress={() => leave(() => (play.targetId ? go.play(play.targetId) : go.open(item.Id)))}
            />
          )}
          <SheetActionGrid
            item={item}
            overlay={overlay}
            onClose={dismiss}
            onOpenDetails={() => { if (item) leave(() => go.open(item.Id)); }}
            onDismiss={() => {
              if (reco) feedback.mutate({ itemKey: reco.key, action: "dismissed" });
              dismiss();
            }}
          />
          {overlay.rate && (identity ? (
            <RatingPanelMobile
              identity={identity}
              jellyfinItemId={tmdbIdentity ? null : ratingTarget.jellyfinItemId}
              variant="sheet"
            />
          ) : (
            // La série se charge : la place des étoiles est gardée, la feuille
            // ne saute pas quand elles arrivent.
            <View style={st.ratingSlot} />
          ))}
        </>
      )}
    </SheetFrame>
  );
}

const st = StyleSheet.create({
  reasons: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  ratingSlot: { height: 96 },
});
