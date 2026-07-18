import { memo, useCallback } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Focusable } from "../focus/Focusable";
import { Colors, Radius, Fonts } from "../../theme/colors";
import { RAIL_COLLAPSED, type RailItem } from "./TVSideRail";

interface RailRowProps {
  item: RailItem;
  /** Index dans le ScrollView (haut) — null pour les items du bas (fixes). */
  index?: number;
  active: boolean;
  /** Style animé du libellé (opacity + translate), partagé par tout le rail. */
  labelStyle: ReturnType<typeof useAnimatedStyle>;
  onNavigate: (key: string) => void;
  onExpand: () => void;
  onCollapse: () => void;
  schedulePrefetch: (libraryId: string) => void;
  cancelPrefetch: () => void;
  /** Fabrique le handler de scroll-into-view pour l'index donné. */
  makeOnFocus: (index: number, pad: number) => () => void;
  /** Ref de l'item actif (cible du TVFocusGuideView quand on entre dans le rail). */
  setActiveRef: (node: View | null) => void;
  /** Capture du nœud natif (pont de focus inter-groupes, cf. TVSideRail). */
  captureNode?: (node: View | null) => void;
  /** Cibles de navigation explicites (Android : court-circuite la géométrie). */
  nextFocusUp?: number;
  nextFocusDown?: number;
}

/**
 * Une ligne du rail. Mémoïsée : au changement de route, seules les deux lignes
 * dont `active` bascule re-rendent — les autres restent figées. Les closures de
 * focus sont locales mais le composant ne re-rend pas tant que ses props sont
 * stables (handlers `useCallback` côté parent).
 */
export const RailRow = memo(function RailRow({
  item, index, active, labelStyle, onNavigate, onExpand, onCollapse,
  schedulePrefetch, cancelPrefetch, makeOnFocus, setActiveRef, captureNode,
  nextFocusUp, nextFocusDown,
}: RailRowProps) {
  const iconColor = item.danger ? Colors.error : active ? Colors.textPrimary : Colors.textTertiary;
  const scrollFocus = index != null ? makeOnFocus(index, 48) : null;
  const libraryId = item.key.startsWith("Library_") ? item.key.slice("Library_".length) : null;
  // Ref composée : capture (pont inter-groupes) + item actif (entrée du rail).
  const refCb = useCallback((node: View | null) => {
    captureNode?.(node);
    if (active) setActiveRef(node);
  }, [captureNode, active, setActiveRef]);

  return (
    <Focusable
      ref={captureNode || active ? refCb : undefined}
      variant="row"
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      focusRadius={Radius.buttonLarge}
      onPress={() => onNavigate(item.key)}
      onFocus={() => {
        onExpand();
        scrollFocus?.();
        if (libraryId) schedulePrefetch(libraryId);
      }}
      onBlur={() => { onCollapse(); if (libraryId) cancelPrefetch(); }}
      accessibilityLabel={item.label}
    >
      <View style={{ flexDirection: "row", alignItems: "center", height: 48, borderRadius: Radius.buttonLarge }}>
        <View style={{ width: RAIL_COLLAPSED - 24, alignItems: "center", justifyContent: "center" }}>
          {/* Pastille violette derrière l'icône active (repère en mode replié) */}
          {active && (
            <View style={{
              position: "absolute", width: 40, height: 40, borderRadius: 20,
              backgroundColor: "rgba(139, 92, 246, 0.22)",
            }} />
          )}
          {item.icon(iconColor)}
        </View>
        <Animated.Text
          numberOfLines={1}
          style={[{
            flex: 1,
            color: item.danger ? Colors.error : Colors.textPrimary,
            fontSize: 15,
            fontFamily: active ? Fonts.bold : Fonts.regular,
          }, labelStyle]}
        >
          {item.label}
        </Animated.Text>
      </View>
    </Focusable>
  );
});
