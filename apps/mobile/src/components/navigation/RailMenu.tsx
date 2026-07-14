import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useRouter, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { GlassSurface } from "@/components/ui/GlassSurface";

const PANEL_W = 248;
const OPEN_MS = 220;
const CLOSE_MS = 160; // sortie plus courte que l'entrée (réactivité perçue)

export interface RailMenuItem {
  href: Href;
  icon: string;
  label: string;
}

interface RailMenuProps {
  open: boolean;
  onClose: () => void;
  items: RailMenuItem[];
}

/**
 * Menu déroulant du rail paysage iPad : panneau glass discret qui glisse
 * depuis la gauche par-dessus le contenu (scrim tap-pour-fermer). Les items
 * naviguent via expo-router (actif = pathname), puis le menu se referme.
 */
export function RailMenu({ open, onClose, items }: RailMenuProps) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(open ? 1 : 0, {
      duration: open ? OPEN_MS : CLOSE_MS,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [open, anim]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: anim.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (anim.value - 1) * (PANEL_W + 24) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, st.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
      </Animated.View>

      <Animated.View style={[st.panel, panelStyle]} accessibilityViewIsModal>
        {/* intensity 50 = valeur pixel-perfect historique du panneau rail. */}
        <GlassSurface tint="strong" intensity={50} radius={0} bordered={false} style={styles.panelFill}>
          <View style={{ paddingTop: Math.max(insets.top, 24) + 10, paddingHorizontal: 12, flex: 1 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              hitSlop={8}
              style={({ pressed }) => [st.closeBtn, pressed && st.pressed]}
            >
              <Feather name="menu" size={20} color={theme.colors.text.secondary} />
            </Pressable>

            <View style={{ gap: 4 }}>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Pressable
                    key={String(item.href)}
                    onPress={() => { router.navigate(item.href); onClose(); }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [st.row, active && st.rowActive, pressed && !active && st.pressed]}
                  >
                    <Feather name={item.icon as never} size={20} color={active ? theme.colors.brand.violet : theme.colors.text.tertiary} />
                    <Text style={[st.rowLabel, active && { color: theme.colors.brand.violet }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

// Géométrie pure (aucune couleur).
const styles = StyleSheet.create({
  panelFill: { flex: 1 },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrim: { backgroundColor: t.colors.overlay.scrimSoft },
    panel: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: PANEL_W,
      overflow: "hidden" as const,
      borderRightColor: t.colors.border.subtle,
      borderRightWidth: StyleSheet.hairlineWidth,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginLeft: 4,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      height: 46,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    rowActive: { backgroundColor: t.colors.brand.ghost },
    rowLabel: {
      fontSize: 13.5,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.secondary,
      flex: 1,
    },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
