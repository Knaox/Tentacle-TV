import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { GlassSurface } from "@/components/ui";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useScrollChromeValue } from "./scrollChrome";

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
/** Marge basse minimale sous la pilule, sur un appareil sans encoche. */
const MIN_BOTTOM_INSET = 10;

/** Hauteur de la pilule elle-même (icône, capsule, libellé, marges internes). */
const BAR_HEIGHT = 63;

/**
 * Hauteur TOTALE occupée par la barre flottante, inset bas compris.
 *
 * Le contenu passe DESSOUS (c'est tout l'intérêt du verre), donc personne n'a
 * à la réserver — sauf ce qui est ancré en bas et ne défile pas. Les plugins,
 * qui vivent dans une WebView descendant jusqu'au bord de l'écran, n'ont aucun
 * moyen de la mesurer : on la leur publie (voir `pluginHtmlTemplate`).
 */
export function useGlassTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_INSET);
}

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  // Minimisation au défilement, façon iOS 26 : la pilule se compacte (scale +
  // légère descente) et les libellés s'effacent. Transform/opacity UNIQUEMENT,
  // sur le wrapper — jamais sur le GlassView natif — et les hauteurs publiées
  // (`useGlassTabBarHeight`, contrat des WebViews plugins) ne bougent PAS.
  const fallback = useSharedValue(0);
  const collapsed = useScrollChromeValue() ?? fallback;
  const shrinkStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: collapsed.value * 10 },
      { scale: 1 - collapsed.value * 0.12 },
    ],
  }));
  const labelFade = useAnimatedStyle(() => ({ opacity: 1 - collapsed.value }));

  const routes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return StyleSheet.flatten(options.tabBarItemStyle)?.display !== "none";
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[st.wrap, { paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }, shrinkStyle]}
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
                <Animated.Text numberOfLines={1} style={[st.label, { color: tint }, labelFade]}>
                  {options.title ?? route.name}
                </Animated.Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </Animated.View>
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
