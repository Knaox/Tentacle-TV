import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCardRatingTarget, useMediaItem, useSendRecoFeedback } from "@tentacle-tv/api-client";
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
 * Une seule feuille pour toutes les cartes de la bibliothèque : affiches,
 * vignettes 16:9, lignes d'épisode, recommandations, titres gardés sur
 * l'appareil. Un titre HORS bibliothèque a la sienne, celle des cartes Vigie
 * (`CardSheetScope` y envoie une recommandation sans item).
 *
 *   1. l'en-tête (et « Pourquoi ce titre » pour une recommandation) ;
 *   2. Lire / Reprendre — le bouton central du survol, quand quelque chose se
 *      lance (une série : son épisode à reprendre ou à suivre) ;
 *   3. les bascules, dans l'ordre de la pastille d'états : Ma liste, favori,
 *      vu — Ma liste et favori au niveau SÉRIE, « vu » sur le titre montré ;
 *   4. les extras : garder hors ligne, Plus d'infos (carte dont le tap lance
 *      la lecture), Ne plus me proposer (recommandation) ;
 *   5. les étoiles — la série pour une affiche d'épisode, l'épisode pour une
 *      vignette.
 *
 * Un titre lu sur le disque (`local`) n'y garde que la coche « vu », fournie
 * par l'appelant (`toggles`), et ne demande rien au serveur.
 */
export function MediaActionSheet({ target, onClose, navigation }: Props) {
  if (!target) return null;
  return <CardSheet target={target} onClose={onClose} navigation={navigation} />;
}

function CardSheet({ target, onClose, navigation }: { target: CardSheetTarget; onClose: () => void; navigation?: CardSheetNavigation }) {
  const { t } = useTranslation("cards");
  const router = useRouter();
  const feedback = useSendRecoFeedback();
  const local = target.local === true;
  // La fiche complète, lue EN DIRECT : la feuille tient un instantané de la
  // carte, que les mutations optimistes ne touchent pas — elles patchent la
  // fiche `["item", id]`. Chargée à l'ouverture pour toute carte de la
  // bibliothèque (et gardée : la page de détail la retrouve) ; `useCardFace`
  // ne la demande que pour une carte réduite, ce qui suffit au survol web —
  // la carte s'y re-rend — mais laissait ici un film basculé dans son ancien
  // état. Le visage de la carte tient la place le temps qu'elle arrive.
  const { data: fetched, isLoading: fetching } = useMediaItem(local ? undefined : target.item?.Id);
  const item = target.item ? (fetched ?? target.item) : null;
  const play = useSheetPlay(item, { local });

  const reco = target.reco;
  const ratingTarget = useCardRatingTarget(local ? null : item, {
    scope: target.variant === "landscape" ? "item" : "series",
    enabled: !local,
  });
  const identity = ratingTarget.identity;

  const overlay = resolveCardOverlay({
    variant: target.variant,
    inLibrary: item !== null,
    playable: play !== null,
    resume: play?.resume,
    // Un résultat de recherche arrive sans son tmdb : la fiche le porte. Tant
    // qu'elle se charge, la place des étoiles est gardée.
    rateable: identity !== null || ratingTarget.pending || fetching,
    // Le mobile garde hors ligne ; la cellule se tait d'elle-même quand le
    // titre ne s'y prête pas (droits, collection).
    offline: true,
    local,
  });
  // Un titre local n'a d'autres bascules que celles de l'appelant : le
  // serveur, qui porte Ma liste et les favoris, n'est peut-être pas là.
  const toggles = local && !target.toggles ? [] : overlay.toggles;

  const manage = target.manage;
  const go: CardSheetNavigation = target.navigation ?? navigation ?? {
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
            overlay={{ toggles, extras: overlay.extras }}
            handlers={target.toggles}
            onManage={manage ? () => leave(manage) : undefined}
            onClose={dismiss}
            onOpenDetails={() => { if (item) leave(() => go.open(item.Id)); }}
            onDismiss={() => {
              if (reco) feedback.mutate({ itemKey: reco.key, action: "dismissed" });
              dismiss();
            }}
          />
          {overlay.rate && (identity ? (
            <RatingPanelMobile identity={identity} jellyfinItemId={ratingTarget.jellyfinItemId} variant="sheet" />
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
