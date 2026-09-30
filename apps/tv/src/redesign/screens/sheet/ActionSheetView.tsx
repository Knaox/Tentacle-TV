import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { scrim } from "../../theme/tokens";
import { RatingScale } from "./RatingScale";
import { SheetActionRow } from "./SheetActionRow";
import { SheetHeader } from "./SheetHeader";
import type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";

export type { SheetActionKind, SheetActionModel, SheetHeaderModel, SheetRatingModel } from "./sheetTypes";

/**
 * La feuille d'actions d'une carte — l'appui long (OK maintenu), sur toutes
 * les cartes. Ce que le survol du bureau offre, dans le même ordre : la
 * lecture (ou « Demander ») en tête, la note, puis Ma liste → favori → vu,
 * puis les extras (« Plus d'infos » sur toute carte). Un panneau de verre posé
 * à droite, sur un voile qui garde la page visible derrière.
 *
 * La note ne se pose pas ici en étoiles : la ligne « Noter » ouvre l'ÉCHELLE
 * VERTICALE (`RatingScale`, `ratingOpen`), qui prend la place de la liste
 * sous le même en-tête — HAUT / BAS aux valeurs du bureau, demi-étoiles
 * comprises, OK note, Menu revient à la liste.
 *
 * Vue pure. Contrat — tout arrive résolu :
 * - `actions` : `sheetRows` (branchement) — le modèle partagé, « Noter »
 *   après la lecture, « Plus d'infos », « Toutes les plateformes » ; libellés
 *   par `t`, `detail` par `useCardSheetPlay` (la note posée pour « Noter ») ;
 * - `rating` : quand `overlay.rate` — la note par `useTVUserScore`, `pending`
 *   tant que `useCardRatingTarget` résout la série ;
 * - `ratingOpen` : l'échelle à la place de la liste ;
 * - `onAction` : la lecture, les bascules (la feuille reste ouverte, les
 *   libellés basculent sous les yeux), la fiche, le refus, la demande,
 *   « Noter » (le câblage ouvre l'échelle) ; `onRate(note | null)` : 1 à 10,
 *   ou retirer la note.
 * - `actions` vide et `ratingOpen` : la feuille réduite à l'échelle — le
 *   bouton « Noter » de la fiche, qui porte déjà la lecture et les bascules.
 *
 * Focus (câblage) : entrée sur la première action ; le focus est piégé dans
 * la feuille ; Menu ferme — ou, l'échelle ouverte depuis la liste, y revient.
 * Clés : `sheet:action:<kind>`, `sheet:scale…` (`RatingScale`), `sheet:close`.
 */

export interface ActionSheetViewProps {
  header: SheetHeaderModel;
  actions: SheetActionModel[];
  rating?: SheetRatingModel | null;
  /** L'échelle de la note à la place de la liste. */
  ratingOpen?: boolean;
  onAction?: (kind: SheetActionKind) => void;
  /** 1 à 10, ou `null` : retirer la note. */
  onRate?: (score: number | null) => void;
  onClose?: () => void;
}

const WIDTH = 720;

export const ActionSheetView = memo(function ActionSheetView({
  header,
  actions,
  rating,
  ratingOpen = false,
  onAction,
  onRate,
  onClose,
}: ActionSheetViewProps) {
  const scale = ratingOpen && rating ? rating : null;
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
            {scale ? (
              <RatingScale rating={scale} onRate={onRate} />
            ) : actions.length ? (
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
