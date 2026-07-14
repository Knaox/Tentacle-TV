import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "@/components/ui";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Tab bar basse **Liquid Glass flottante** (iPhone / portrait).
 *
 * Bonnes pratiques iOS 26 : le chrome de navigation est une pilule de verre qui
 * FLOTTE au-dessus du contenu (absolute) — le contenu défile dessous et se
 * réfracte à travers le verre (c'est là que le Liquid Glass se voit vraiment,
 * contrairement à un bandeau opaque). Le verre réel est rendu par GlassSurface
 * (bascule expo-glass-effect ↔ fallback blur). L'onglet actif porte une capsule
 * teintée marque (pas de verre-sur-verre, déconseillé par Apple).
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  const routes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return StyleSheet.flatten(options.tabBarItemStyle)?.display !== "none";
  });

  return (
    <View
      pointerEvents="box-none"
      style={[st.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {/* En CLAIR, tintColor biaise la MATIÈRE du verre vers le clair (reste
          vitreux/réfractant) → icônes/texte sombres lisibles même sur image
          sombre. En SOMBRE, pas de teinte (texte clair déjà lisible). */}
      <GlassSurface
        tier="sheet"
        tint="regular"
        radius={30}
        interactive
        tintColor={theme.isDark ? undefined : "rgba(255, 255, 255, 0.18)"}
        style={st.bar}
      >
        <View style={st.row}>
          {routes.map((route) => {
            const index = state.routes.indexOf(route);
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const tint = focused ? theme.colors.brand.violet : theme.colors.text.tertiary;
            const label = options.tabBarAccessibilityLabel ?? options.title ?? route.name;

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
                accessibilityLabel={label}
                style={st.item}
              >
                <View style={[st.pill, focused && st.pillActive]}>
                  {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
                </View>
                <Text numberOfLines={1} style={[st.label, { color: tint }]}>
                  {options.title ?? route.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    // Flottant : au-dessus du contenu, marges latérales (pilule), inset bas safe-area.
    wrap: {
      position: "absolute" as const,
      left: 12,
      right: 12,
      bottom: 0,
    },
    bar: {
      // L'ombre douce détache la pilule ; le verre fournit la matière.
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: t.isDark ? 0.5 : 0.14,
      shadowRadius: 24,
      elevation: 12,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-around" as const,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    item: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 2,
    },
    pill: {
      width: 52,
      height: 32,
      borderRadius: 16,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    // Capsule teintée marque sous l'onglet actif (bien visible sur le verre).
    pillActive: { backgroundColor: t.colors.brand.ghost },
    label: {
      fontSize: 10,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: 0.1,
    },
  });
