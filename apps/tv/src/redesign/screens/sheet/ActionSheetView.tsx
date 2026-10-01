import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { usePresence } from "../../motion/useMotion";
import { SWAP_FLOOR } from "../../motion/useSwap";
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
 * Mouvement (Apple TV) : le voile entre en fondu, le panneau SURGIT — il part
 * de 0,94 et se pose sur un ressort (préréglage `panel`) ; `closing` joue la
 * sortie, plus brève (le panneau se retire en accélérant, le voile s'efface),
 * puis `onClosed` : c'est alors seulement que le câblage retire la `Modal`,
 * présentée sans animation système — un seul fondu, le nôtre, à l'entrée
 * comme à la sortie.
 *
 * Focus (câblage) : ENTRÉE sur l'échelle, à la note posée, sinon à 5/10
 * (`RATING_ENTRY`) — sans échelle, sur le premier picto ; le focus est piégé
 * dans le panneau ; Menu ferme. HAUT depuis l'échelle atteint la croix, BAS
 * l'en ramène au cran retenu. Le panneau s'ouvre sous un OK encore enfoncé :
 * la garde anti-clic fantôme couvre l'échelle, les pictos et la croix.
 * Clés : `sheet:header` et `sheet:close` ; `sheet:scale` et
 * `sheet:scale:<1…10|remove>` ; `sheet:actions` et `sheet:action:<kind>`.
 * Les trois groupes couvrent la largeur du panneau.
 */

export interface ActionSheetViewProps {
  header: SheetHeaderModel;
  actions: SheetActionModel[];
  rating?: SheetRatingModel | null;
  onAction?: (kind: SheetActionKind) => void;
  /** 1 à 10, ou `null` : retirer la note. */
  onRate?: (score: number | null) => void;
  onClose?: () => void;
  /** Le panneau se retire : sa sortie se joue, puis `onClosed`. */
  closing?: boolean;
  onClosed?: () => void;
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
  closing = false,
  onClosed,
}: ActionSheetViewProps) {
  const { rise, veil } = usePanelMotion(closing, onClosed);
  const backing = useNativeGlassBacking("strong");
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      {/* `box-none`, jamais `none` : sur tvOS, un parent qui refuse les
          interactions rend ses enfants infocalisables. */}
      <View pointerEvents="box-none" style={styles.center}>
        <Animated.View style={[styles.frame, rise]}>
          <View style={[styles.base, backing]} />
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

/** Le panneau surgit puis se retire, le voile avec lui (opacité et transform
 *  seulement) ; la fin de la sortie du voile — la plus longue — appelle
 *  `onClosed`. */
function usePanelMotion(closing: boolean, onClosed?: () => void) {
  const panel = usePresence(!closing, "panel");
  const veil = usePresence(!closing, "veil");
  useEffect(() => {
    if (!veil.mounted) onClosed?.();
  }, [veil.mounted, onClosed]);
  const from = TV_MOTION.overlay.panelScale;
  const p = panel.progress;
  const v = veil.progress;
  return {
    // Jamais tout à fait 0 : tvOS tiendrait pour cachés ses focalisables
    // (`SWAP_FLOOR`) et chercherait le focus ailleurs pendant l'entrée.
    rise: useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(SWAP_FLOOR, p.value)), transform: [{ scale: from + (1 - from) * p.value }] })),
    veil: useAnimatedStyle(() => ({ opacity: v.value })),
  };
}

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(0.72) },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: WIDTH },
  // Le fond dense sous le verre dessiné : la page qui passerait derrière se
  // lirait au travers. Le verre natif floute : il prend le fond commun.
  base: { ...StyleSheet.absoluteFillObject, borderRadius: TV_STAGE.radius.sheet, backgroundColor: "rgba(12, 12, 16, 0.95)" },
  panel: { paddingHorizontal: PAD, paddingVertical: 44, gap: 34 },
});
