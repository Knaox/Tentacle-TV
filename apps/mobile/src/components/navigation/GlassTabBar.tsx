import { StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { GlassSurface } from "@/components/ui";
import { useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useScrollChromeValue } from "./scrollChrome";
import { GlassTabItem, LABEL_GAP, LABEL_LINE_HEIGHT, PILL_H, PILL_W } from "./GlassTabItem";
import { TabIndicator } from "./TabIndicator";
import { useSlidingIndicator } from "./useSlidingIndicator";

/**
 * Tab bar basse **Liquid Glass flottante** (iPhone / portrait).
 *
 * Bonnes pratiques iOS 26 : le chrome de navigation est une pilule de verre qui
 * FLOTTE au-dessus du contenu (absolute) — le contenu défile dessous et se
 * réfracte à travers le verre (c'est là que le Liquid Glass se voit vraiment,
 * contrairement à un bandeau opaque). Le verre réel est rendu par GlassSurface
 * (bascule expo-glass-effect ↔ fallback blur). L'onglet actif est marqué par
 * UNE pilule neutre qui glisse d'un onglet à l'autre (TabIndicator) — pas de
 * verre-sur-verre, déconseillé par Apple.
 */
/** Marge basse minimale sous la pilule, sur un appareil sans encoche. */
const MIN_BOTTOM_INSET = 10;
const ROW_PAD_V = 8;

/** Hauteur de la pilule elle-même, DÉRIVÉE de sa géométrie (63). */
const BAR_HEIGHT = 2 * ROW_PAD_V + PILL_H + LABEL_GAP + LABEL_LINE_HEIGHT;

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
  const activeKey = state.routes[state.index]?.key;
  const indicator = useSlidingIndicator(activeKey, { width: PILL_W, height: PILL_H, align: "top" });

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
          {/* La piste : sans marge, le même repère pour les `onLayout` des
              items et le `left/top: 0` de l'indicateur. */}
          <View style={st.track} accessibilityRole="tablist">
            <TabIndicator width={PILL_W} height={PILL_H} style={indicator.style} />
            {routes.map((route) => {
              const focused = state.routes[state.index]?.key === route.key;
              return (
                <GlassTabItem
                  key={route.key}
                  route={route}
                  descriptor={descriptors[route.key]}
                  focused={focused}
                  tint={focused ? theme.colors.brand.violet : theme.colors.text.tertiary}
                  navigation={navigation}
                  onLayout={indicator.onItemLayout(route.key)}
                  labelStyle={labelFade}
                />
              );
            })}
          </View>
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
      paddingVertical: ROW_PAD_V,
      paddingHorizontal: 6,
    },
    track: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
  });
