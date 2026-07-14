import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Largeur du rail paysage — fine et discrète (icônes seules). */
export const RAIL_WIDTH = 76;

interface TabRailProps extends BottomTabBarProps {
  onOpenMenu: () => void;
}

/**
 * Rail de navigation iPad **paysage uniquement** — volontairement discret :
 * fond transparent (le fond app respire), hairline de séparation, icônes
 * seules avec pilule active. Le bouton du haut déroule le `RailMenu`
 * (panneau glass avec libellés). Portrait/iPhone : barre basse classique.
 */
export function TabRail({ state, descriptors, navigation, onOpenMenu }: TabRailProps) {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

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

      <View style={st.items}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // expo-router masque les tabs `href: null` via display:none — on les saute.
          if (StyleSheet.flatten(options.tabBarItemStyle)?.display === "none") return null;
          const focused = state.index === index;
          const tint = focused ? theme.colors.brand.violet : theme.colors.text.tertiary;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
              style={({ pressed }) => [st.item, focused && st.itemActive, pressed && !focused && st.pressed]}
            >
              {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
            </Pressable>
          );
        })}
      </View>
    </View>
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
      width: 50,
      height: 44,
      borderRadius: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    itemActive: { backgroundColor: t.colors.brand.ghost },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
