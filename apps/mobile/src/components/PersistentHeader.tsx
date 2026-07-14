import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { NotificationBell } from "./NotificationBell";
import { TentacleLogo } from "./TentacleLogo";
import { GlassSurface } from "@/components/ui";
import { spacing, useTheme, withAlpha } from "@/theme";

/** Hauteur de la barre de contenu du header (hors safe-area). */
export const HEADER_BAR_HEIGHT = 44;

/**
 * Hauteur TOTALE du header flottant (safe-area + barre). Les écrans d'onglets
 * l'ajoutent en `paddingTop` de leur contenu : le contenu reste à la même place
 * visuellement, mais défile DESSOUS le header en verre → réfraction Liquid Glass.
 */
export function useHeaderHeight(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 24) + HEADER_BAR_HEIGHT;
}

/**
 * Header persistant en **Liquid Glass flottant** (absolute au-dessus du contenu,
 * qui défile dessous et se réfracte — bonne pratique iOS 26). En thème CLAIR, une
 * teinte claire (glass.tintStrong) garde la barre d'état iOS (heure/batterie) ET
 * le logo lisibles malgré le contenu sombre qui défile derrière le verre. En
 * SOMBRE, verre tel quel (icônes claires déjà lisibles).
 */
export function PersistentHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;

  return (
    <GlassSurface
      tier="modal"
      tint="regular"
      radius={0}
      bordered={false}
      tintColor={theme.isDark ? undefined : "rgba(255, 255, 255, 0.25)"}
      style={styles.wrap}
    >
      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 24) + 2 }]}>
        <View style={styles.logoRow}>
          <TentacleLogo size={28} />
          <Text style={[styles.title, { color: colors.text.primary }]}>Tentacle TV</Text>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push("/watchlist")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Watchlist">
            <Feather name="bookmark" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable onPress={() => router.push("/favorites")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Favorites">
            <Feather name="heart" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable onPress={() => router.push("/search")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search">
            <Feather name="search" size={20} color={colors.text.primary} />
          </Pressable>
          <NotificationBell />
        </View>
      </View>
      <View style={[styles.hairline, { backgroundColor: withAlpha(colors.brand.violet, 0.12, colors.brand.soft) }]} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  bar: {
    paddingBottom: 10,
    paddingHorizontal: spacing.screenPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  hairline: { height: StyleSheet.hairlineWidth, width: "100%" },
});
