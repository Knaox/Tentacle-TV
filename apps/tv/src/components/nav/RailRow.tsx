import { memo, useCallback } from "react";
import { View, Text } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { RAIL, largeurEntreeDeployee } from "@tentacle-tv/tv-core";
import { TV_OVERSCAN_PT, TV_RADIUS } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { Colors, Fonts } from "../../theme/colors";
import { FocusRowStyle } from "../../theme/focus";
import type { RailItem } from "./railEntries";

const LARGEUR_DEPLOYEE = largeurEntreeDeployee(TV_OVERSCAN_PT.x);

interface RailRowProps {
  item: RailItem;
  active: boolean;
  deploye: boolean;
  /** Opacité + translation du libellé, partagées par tout le rail. */
  labelStyle: ReturnType<typeof useAnimatedStyle>;
  onNavigate: (key: string) => void;
  onMasquer: (key: string) => void;
  onExpand: () => void;
  onCollapse: () => void;
  schedulePrefetch: (libraryId: string) => void;
  cancelPrefetch: () => void;
  setActiveRef: (node: View | null) => void;
  captureNode?: (node: View | null) => void;
  nextFocusUp?: number;
  nextFocusDown?: number;
}

/**
 * Une entrée du rail, à la géométrie de la LG.
 *
 * Deux choses la distinguent de la version précédente. Sa largeur ne s'anime
 * pas : elle change d'un état à l'autre sans transition, parce que le rail ne
 * bouge plus — c'est un panneau posé derrière lui qui apparaît en fondu, et le
 * moteur de focus vient de calculer sa géométrie sur ces positions.
 *
 * Et le libellé est posé en absolu : il déborde du rail replié sans élargir
 * l'entrée, ce qui réserve sa place dans les deux états. Sans cela, le texte se
 * replierait en colonne sur douze pixels quand le rail est fermé — invisible,
 * mais recalculé à chaque image de la transition.
 */
export const RailRow = memo(function RailRow({
  item, active, deploye, labelStyle, onNavigate, onMasquer, onExpand,
  onCollapse, schedulePrefetch, cancelPrefetch, setActiveRef,
  captureNode, nextFocusUp, nextFocusDown,
}: RailRowProps) {
  const couleurIcone = item.danger
    ? Colors.error
    : active ? Colors.textPrimary : Colors.textSecondary;
  const libraryId = item.key.startsWith("Library_")
    ? item.key.slice("Library_".length)
    : null;

  const refCb = useCallback((node: View | null) => {
    captureNode?.(node);
    if (active) setActiveRef(node);
  }, [captureNode, active, setActiveRef]);

  // Un maintien retire l'entrée du rail. Seules les destinations le permettent :
  // la recherche, l'accueil et la navigation de service doivent rester
  // atteignables, sinon le rail devient une impasse.
  const surMaintien = useCallback(() => {
    if (item.masquable) onMasquer(item.key);
  }, [item.masquable, item.key, onMasquer]);

  return (
    <Focusable
      ref={captureNode || active ? refCb : undefined}
      variant="row"
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      focusRadius={TV_RADIUS.md}
      // La largeur vit sur le FOCUSABLE, pas sur la vue interne : le fond de
      // focus (overlay de la variante « ligne ») épouse le Pressable — posée à
      // l'intérieur, elle débordait et le fond focus s'arrêtait à l'icône,
      // alors que la LG surligne l'entrée déployée entière.
      style={{ width: deploye ? LARGEUR_DEPLOYEE : RAIL.largeurRepli }}
      onPress={() => onNavigate(item.key)}
      onLongPress={item.masquable ? surMaintien : undefined}
      onFocus={() => {
        onExpand();
        if (libraryId) schedulePrefetch(libraryId);
      }}
      onBlur={() => { onCollapse(); if (libraryId) cancelPrefetch(); }}
      accessibilityLabel={item.label}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: RAIL.hauteurEntree,
          minHeight: RAIL.hauteurEntreeMin,
          marginBottom: RAIL.ecartEntrees,
          paddingLeft: RAIL.retraitEntree,
          borderRadius: TV_RADIUS.md,
          // Le fond de l'entrée ACTIVE. Celui du focus est peint par-dessus par
          // `Focusable` (variante « ligne »), et il l'emporte visuellement.
          backgroundColor: active ? FocusRowStyle.activeBgColor : "transparent",
        }}
      >
        <View
          style={{
            width: RAIL.largeurIcone,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {item.icon(couleurIcone)}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", left: RAIL.libelleGauche }, labelStyle]}
        >
          <Text
            numberOfLines={1}
            style={{
              color: item.danger
                ? Colors.error
                : active ? Colors.textPrimary : Colors.textSecondary,
              fontSize: 20,
              fontFamily: Fonts.semibold,
            }}
          >
            {item.label}
          </Text>
        </Animated.View>
      </View>
    </Focusable>
  );
});
