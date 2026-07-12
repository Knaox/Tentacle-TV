import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { NotificationBell } from "./NotificationBell";
import { TentacleLogo } from "./TentacleLogo";
import { colors, spacing } from "@/theme";

export function PersistentHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{
      backgroundColor: colors.background,
      // Plancher 24pt = hauteur barre d'état iOS : sur iPad `insets.top` peut
      // remonter ~0 et coller le header à l'heure/WiFi/batterie. Sur iPhone à
      // encoche, insets.top (≥44) l'emporte → aucun changement.
      paddingTop: Math.max(insets.top, 24) + 4,
      paddingBottom: 10,
      paddingHorizontal: spacing.screenPadding,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(139, 92, 246, 0.1)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    }}>
      {/* Logo */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TentacleLogo size={28} />
        <Text style={{
          fontSize: 22,
          fontWeight: "800",
          color: colors.textPrimary,
        }}>
          Tentacle TV
        </Text>
      </View>

      {/* Right actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Pressable onPress={() => router.push("/watchlist")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Watchlist">
          <Feather name="bookmark" size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push("/favorites")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Favorites">
          <Feather name="heart" size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push("/search")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search">
          <Feather name="search" size={20} color={colors.textPrimary} />
        </Pressable>
        <NotificationBell />
      </View>
    </View>
  );
}
