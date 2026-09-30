import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { scrim } from "../../theme/tokens";
import { RatingPanel } from "./RatingPanel";
import { SheetHeader } from "./SheetHeader";
import { SheetPictos } from "./SheetPictos";
import type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";

export type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";
export { RATING_ENTRY, SCALE_FOCUS_KEYS, scaleFocusKey } from "./ratingScaleKeys";

/**
 * Le GRAND PANNEAU d'une carte — l'appui maintenu (OK tenu), sur toutes les
 * cartes. Sur Apple TV, rien ne se fait sur la carte elle-même : tout est ici,
 * centré, sur un voile qui assombrit la page, dans cet ordre :
 *   • l'en-tête : l'image de la carte, son titre, la croix ;
 *   • la note : les étoiles en grand, puis l'ÉCHELLE HORIZONTALE
 *     (`RatingPanel`, `RatingRuler`) — GAUCHE / DROITE, les valeurs défilent
 *     de droite à gauche, la valeur visée au centre, « Retirer la note » au
 *     bout ;
 *   • les pictos des actions (`SheetPictos`), dans l'ordre du modèle partagé :
 *     la lecture (ou « Demander ») au dégradé de marque, Ma liste → favori →
 *     vu, puis les extras.
 *
 * Vue pure. Contrat — tout arrive résolu :
 * - `actions` : `sheetRows` (branchement) — le modèle partagé,
 *   « Plus d'infos », « Toutes les plateformes » ; libellés par `t`, `detail`
 *   par `useCardSheetPlay`. Vide : le panneau réduit à la note — le bouton
 *   « Noter » de la fiche ;
 * - `rating` : quand `overlay.rate` ; `pending` tant que la note ou sa cible
 *   se résolvent ;
 * - `onAction` : la lecture, les bascules (le panneau reste ouvert, libellés
 *   et glyphes basculent sous les yeux), la fiche, le refus, la demande ;
 *   `onRate(note | null)` : 1 à 10, ou retirer la note.
 *
 * Focus (câblage) : ENTRÉE sur l'échelle, à la note posée, sinon à 5/10
 * (`RATING_ENTRY`) — sans échelle, sur le premier picto ; le focus est piégé
 * dans le panneau ; Menu ferme. Le panneau s'ouvre sous un OK encore enfoncé :
 * la garde anti-clic fantôme couvre l'échelle, les pictos et la croix.
 * Clés : `sheet:scale` et `sheet:scale:<1…10|remove>` ; `sheet:actions` et
 * `sheet:action:<kind>` ; `sheet:close`.
 */

export interface ActionSheetViewProps {
  header: SheetHeaderModel;
  actions: SheetActionModel[];
  rating?: SheetRatingModel | null;
  onAction?: (kind: SheetActionKind) => void;
  /** 1 à 10, ou `null` : retirer la note. */
  onRate?: (score: number | null) => void;
  onClose?: () => void;
}

const WIDTH = 1200;
const PAD = 56;

export const ActionSheetView = memo(function ActionSheetView({
  header,
  actions,
  rating,
  onAction,
  onRate,
  onClose,
}: ActionSheetViewProps) {
  const rise = usePanelEntrance();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(200)} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil]} />
      {/* `box-none`, jamais `none` : sur tvOS, un parent qui refuse les
          interactions rend ses enfants infocalisables. */}
      <View pointerEvents="box-none" style={styles.center}>
        <Animated.View style={[styles.frame, rise]}>
          <View style={styles.base} />
          <GlassSurface radius={TV_STAGE.radius.sheet} tone="strong" elevated style={styles.panel}>
            <SheetHeader header={header} onClose={onClose} />
            {rating ? <RatingPanel rating={rating} width={WIDTH - 2 * PAD} onRate={onRate} /> : null}
            {actions.length ? <SheetPictos actions={actions} onAction={onAction} /> : null}
          </GlassSurface>
        </Animated.View>
      </View>
    </View>
  );
});

/** Le panneau surgit : un fondu et un léger agrandissement (opacité et transform seulement). */
function usePanelEntrance() {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(1, { duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic) });
  }, [p, reduced]);
  return useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.96 + 0.04 * p.value }] }));
}

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(0.72) },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: WIDTH },
  // Le fond dense sous le verre : la page qui passerait derrière ne se lirait
  // pas au travers.
  base: { ...StyleSheet.absoluteFillObject, borderRadius: TV_STAGE.radius.sheet, backgroundColor: "rgba(12, 12, 16, 0.95)" },
  panel: { paddingHorizontal: PAD, paddingVertical: 44, gap: 34 },
});
