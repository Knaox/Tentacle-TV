import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { scrim } from "../../theme/tokens";
import { SheetActionRow } from "./SheetActionRow";
import { SheetHeader } from "./SheetHeader";
import { SheetRating } from "./SheetRating";
import type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";

export type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";

/**
 * La feuille d'actions d'une carte — l'appui long (OK maintenu), sur toutes
 * les cartes. Ce que le survol du bureau offre, dans le même ordre : la
 * lecture (ou « Demander ») en tête, puis Ma liste → favori → vu, puis les
 * extras, puis la note en étoiles. Un panneau de verre posé à droite, sur un
 * voile qui garde la page visible derrière.
 *
 * Vue pure. Contrat — tout arrive résolu :
 * - `actions` : `cardActionEntries(resolveCardOverlay({ variant, inLibrary,
 *   playable, resume, rateable, offline: false }), useCardToggles(face).states)`
 *   — ou `externalCardActionEntries` pour un titre hors bibliothèque —, les
 *   libellés par `t("cards:" + labelKey)`, `detail` par `useCardSheetPlay` ;
 *   « Toutes les plateformes » (`providersAll`) suit, sous un filtre actif ;
 * - `rating` : quand `overlay.rate` — la note par `useTVUserScore`,
 *   `pending` tant que `useCardRatingTarget` résout la série ;
 * - `onAction` : la lecture, les bascules (la feuille reste ouverte, les
 *   libellés basculent sous les yeux), la fiche, le refus, la demande ;
 *   `onRate(étoiles)` : note = étoiles × 2, la note actuelle se retire.
 * - `actions` vide : la feuille réduite à sa note — le bouton « Noter » de la
 *   fiche, qui porte déjà la lecture et les bascules.
 *
 * Focus (câblage) : entrée sur la première action ; le focus est piégé dans
 * la feuille ; Retour ferme. Clés du banc : `sheet:action:<kind>`,
 * `sheet:star:<n>`, `sheet:close`.
 */

export interface ActionSheetViewProps {
  header: SheetHeaderModel;
  actions: SheetActionModel[];
  rating?: SheetRatingModel | null;
  onAction?: (kind: SheetActionKind) => void;
  onRate?: (stars: number) => void;
  onClose?: () => void;
}

const WIDTH = 720;

export const ActionSheetView = memo(function ActionSheetView({
  header,
  actions,
  rating,
  onAction,
  onRate,
  onClose,
}: ActionSheetViewProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, styles.veil]} />
        {/* Plus sombre à droite : le panneau se détache, la page reste lisible à gauche. */}
        <LinearGradient
          colors={[scrim(0), scrim(0.55)]}
          start={{ x: 0.3, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(240)} style={styles.column}>
        <View>
          <View style={styles.base} />
          <GlassSurface radius={TV_STAGE.radius.sheet} tone="strong" elevated style={styles.panel}>
            <SheetHeader header={header} onClose={onClose} />
            {/* Sans action (« Noter » depuis la fiche), la note suit l'en-tête à un seul écart. */}
            {actions.length ? (
              <View style={styles.actions}>
                {actions.map((action) => (
                  <SheetActionRow
                    key={action.kind}
                    action={action}
                    focusKey={`sheet:action:${action.kind}`}
                    onPress={onAction ? () => onAction(action.kind) : undefined}
                  />
                ))}
              </View>
            ) : null}
            {rating ? <SheetRating rating={rating} onRate={onRate} /> : null}
          </GlassSurface>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(0.58) },
  column: {
    position: "absolute",
    top: TV_STAGE.safe.y,
    bottom: TV_STAGE.safe.y,
    right: TV_STAGE.safe.x - 32,
    width: WIDTH,
    justifyContent: "center",
  },
  // Le fond dense sous le verre : un texte de page qui passerait derrière ne
  // se lirait pas au travers.
  base: { ...StyleSheet.absoluteFillObject, borderRadius: TV_STAGE.radius.sheet, backgroundColor: "rgba(12, 12, 16, 0.95)" },
  panel: { paddingHorizontal: 34, paddingVertical: 34, gap: 30 },
  actions: { gap: 10 },
});
