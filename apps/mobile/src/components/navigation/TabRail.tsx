import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";
import { spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { TabIndicator } from "./TabIndicator";
import { useSlidingIndicator } from "./useSlidingIndicator";
import { useTabPressFeedback } from "./useTabPressFeedback";

/** Largeur du rail paysage — fine et discrète (icônes seules). */
export const RAIL_WIDTH = 76;
const ITEM_W = 50;
const ITEM_H = 44;

interface TabRailProps extends BottomTabBarProps {
  onOpenMenu: () => void;
}

/**
 * Rail de navigation iPad **paysage uniquement** — volontairement discret :
 * fond transparent (le fond app respire), hairline de séparation, icônes
 * seules avec la même pilule glissante que la barre basse (TabIndicator) et
 * le même rebond d'appui. Le bouton du haut déroule le `RailMenu` (panneau
 * glass avec libellés). Portrait/iPhone : barre basse classique.
 */
export function TabRail({ state, descriptors, navigation, onOpenMenu }: TabRailProps) {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const activeKey = state.routes[state.index]?.key;
  const indicator = useSlidingIndicator(activeKey, { width: ITEM_W, height: ITEM_H, align: "center" });

  return (
    <View style={st.rail}>
      <Pressable
        onPress={onOpenMenu}
        accessibilityRole="button"
        accessibilityLabel={t("more")}
        hitSlop={8}
        style={({ pressed }) => [st.toggle, pressed && st.pressed]}
      >
        <Feather name="menu" size={20} color={theme.colors.text.tertiary} />
      </Pressable>

      {/* La piste : repère commun des `onLayout` et de l'indicateur. */}
      <View style={st.items} accessibilityRole="tablist">
        <TabIndicator width={ITEM_W} height={ITEM_H} style={indicator.style} />
        {state.routes.map((route) => {
          const { options } = descriptors[route.key];
          // expo-router masque les tabs `href: null` via display:none — on les saute.
          if (StyleSheet.flatten(options.tabBarItemStyle)?.display === "none") return null;
          const focused = activeKey === route.key;
          return (
            <RailItem
              key={route.key}
              label={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
              focused={focused}
              icon={options.tabBarIcon?.({
                focused,
                color: focused ? theme.colors.brand.violet : theme.colors.text.tertiary,
                size: 22,
              })}
              onLayout={indicator.onItemLayout(route.key)}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

function RailItem({ label, focused, icon, onLayout, onPress, onLongPress }: {
  label: string;
  focused: boolean;
  icon: React.ReactNode;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const st = useThemedStyles(makeStyles);
  const press = useTabPressFeedback();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={st.item}
    >
      <Animated.View style={press.bounceStyle}>{icon}</Animated.View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    rail: {
      width: RAIL_WIDTH,
      backgroundColor: "transparent",
      borderRightColor: t.colors.border.subtle,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingTop: spacing.md,
      alignItems: "center" as const,
    },
    toggle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: spacing.lg,
    },
    items: { gap: 8, alignItems: "center" as const },
    item: {
      width: ITEM_W,
      height: ITEM_H,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
