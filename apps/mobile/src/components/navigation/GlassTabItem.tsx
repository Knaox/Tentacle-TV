import { Pressable, StyleSheet, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated from "react-native-reanimated";
import { FONT_FAMILY } from "@/theme";
import { useTabPressFeedback } from "./useTabPressFeedback";

export const PILL_W = 52;
export const PILL_H = 32;
export const LABEL_GAP = 2;
export const LABEL_LINE_HEIGHT = 13;

type Route = BottomTabBarProps["state"]["routes"][number];
type Descriptor = BottomTabBarProps["descriptors"][string];

interface Props {
  route: Route;
  descriptor: Descriptor;
  focused: boolean;
  tint: string;
  navigation: BottomTabBarProps["navigation"];
  onLayout: (e: LayoutChangeEvent) => void;
  /** Styles animés de la barre (repli au défilement). */
  iconStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

/**
 * Un onglet de la barre basse : le cadre de l'icône (celui que l'indicateur
 * vient couvrir) puis le libellé. La cible est l'item entier (≥ 44 pt de
 * large sur cinq onglets, contigus : pas de `hitSlop`). L'icône rebondit
 * sous le doigt (useTabPressFeedback) — l'`Animated.View` vit DANS le
 * Pressable, la cible ne rétrécit pas.
 */
export function GlassTabItem({ route, descriptor, focused, tint, navigation, onLayout, iconStyle, labelStyle }: Props) {
  const { options } = descriptor;
  const label = options.tabBarAccessibilityLabel ?? options.title ?? route.name;
  const press = useTabPressFeedback();

  const onPress = () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={st.item}
    >
      <Animated.View style={[st.pill, iconStyle]}>
        <Animated.View style={press.bounceStyle}>
          {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
        </Animated.View>
      </Animated.View>
      {/* Étiré sur la largeur de l'onglet et centré par le texte : mesuré au
          premier rendu à sa largeur naturelle, Android coupait « Profil » en
          « Pro… » quel que soit l'espace libre. Police non agrandie : la
          hauteur de la barre est un contrat (useGlassTabBarHeight). */}
      <Animated.Text numberOfLines={1} allowFontScaling={false} style={[st.label, { color: tint }, labelStyle]}>
        {options.title ?? route.name}
      </Animated.Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: LABEL_GAP,
  },
  pill: {
    width: PILL_W,
    height: PILL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    alignSelf: "stretch",
    textAlign: "center",
    paddingHorizontal: 2,
    fontSize: 10,
    lineHeight: LABEL_LINE_HEIGHT,
    fontFamily: FONT_FAMILY.semibold,
  },
});
