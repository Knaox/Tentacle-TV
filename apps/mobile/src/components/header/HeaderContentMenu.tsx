import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { PulseDot } from "@/offline/entry/PulseDot";
import { FONT_FAMILY, motion, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const PANEL_W = 264;
const ROW_H = 52;
const OPEN_MS = 200;
const CLOSE_MS = 140; // sortie plus courte que l'entrée (réactivité perçue)
/** Toutes les orientations : sur iPad paysage, une Modal « portrait » ferait pivoter l'app. */
const ORIENTATIONS = ["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"] as const;

interface Entry {
  href: Href;
  icon: "bookmark" | "heart" | "smartphone";
  /** Un filet le sépare de ce qui précède (ce n'est plus une liste). */
  apart?: boolean;
  label: string;
  hint?: string;
  pulse?: boolean;
}

/**
 * « Mes contenus » : Ma liste, Mes favoris et Sur cet appareil derrière UNE
 * icône de l'en-tête — ce qu'on a mis de côté, ce qu'on aime, ce qu'on garde
 * sur le téléphone. Cinq icônes serrées sur 343 pt (≈ 36 pt de cible
 * chacune) en deviennent trois, espacées — la recherche et la cloche gardent
 * leur accès direct. Le menu se déroule sous l'icône, comme le menu d'une
 * barre iOS ; « Sur cet appareil », qui n'est pas une liste, y est posé à
 * part. Un transfert en cours reste visible sur l'icône (le point qui pulse)
 * et dans le menu.
 */
export function HeaderContentMenu({ anchorTop }: {
  /** Bas de l'en-tête, en points depuis le haut de l'écran : le menu s'y accroche. */
  anchorTop: number;
}) {
  const { t } = useTranslation("nav");
  const { t: to } = useTranslation("offline");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const { visible: onDeviceVisible } = useOfflineVisibility();
  const { active } = useOfflineActivity();
  const [open, setOpen] = useState(false);
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(open ? 1 : 0, {
      duration: motion.respectReducedMotion(open ? OPEN_MS : CLOSE_MS),
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [open, anim]);

  const close = useCallback(() => setOpen(false), []);
  const go = useCallback((href: Href) => { setOpen(false); router.push(href); }, [router]);

  const entries: Entry[] = [
    { href: "/watchlist", icon: "bookmark", label: t("myList") },
    { href: "/favorites", icon: "heart", label: t("myFavorites") },
    ...(onDeviceVisible
      ? [{ href: "/on-device" as Href, icon: "smartphone" as const, label: t("onDevice"), hint: active > 0 ? to("a11yTransferActive") : undefined, pulse: active > 0, apart: true }]
      : []),
  ];

  const scrimStyle = useAnimatedStyle(() => ({ opacity: anim.value }));
  // Le panneau naît de l'icône : il glisse de quelques points vers le bas en
  // grandissant depuis son coin haut droit.
  const panelStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: (anim.value - 1) * 8 }, { scale: 0.94 + anim.value * 0.06 }],
  }));

  const label = active > 0 ? `${t("myContent")}, ${to("a11yTransferActive")}` : t("myContent");

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
      >
        <View collapsable={false} style={st.iconWrap}>
          {/* Une pile : « ce qui est à moi », pas le signet de la seule Ma liste. */}
          <Feather name="layers" size={21} color={theme.colors.text.primary} />
          {active > 0 && <PulseDot size={8} />}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close} supportedOrientations={[...ORIENTATIONS]} statusBarTranslucent>
        <Animated.View style={[StyleSheet.absoluteFill, st.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={tc("close")} />
        </Animated.View>
        <Animated.View
          style={[st.panel, { top: anchorTop - 6, transformOrigin: "top right" }, panelStyle]}
          accessibilityViewIsModal
        >
          {/* Une surface PLEINE : le verre natif d'iOS 26, presque transparent,
              laissait les lignes flotter illisibles sur l'affiche de l'accueil. */}
          <View style={st.panelFill}>
            <Text style={st.title} accessibilityRole="header">{t("myContent")}</Text>
            {entries.map((entry) => (
              <View key={String(entry.href)}>
              {entry.apart && <View style={st.divider} />}
              <Pressable
                onPress={() => go(entry.href)}
                accessibilityRole="menuitem"
                accessibilityLabel={entry.hint ? `${entry.label}, ${entry.hint}` : entry.label}
                style={({ pressed }) => [st.row, pressed && st.rowPressed]}
              >
                <View style={st.rowIcon}>
                  <Feather name={entry.icon} size={19} color={theme.colors.text.secondary} />
                  {entry.pulse && <PulseDot size={7} />}
                </View>
                <View style={st.rowText}>
                  <Text style={st.rowLabel} numberOfLines={1}>{entry.label}</Text>
                  {entry.hint && <Text style={st.rowHint} numberOfLines={1}>{entry.hint}</Text>}
                </View>
                <Feather name="chevron-right" size={18} color={theme.colors.text.quaternary} />
              </Pressable>
              </View>
            ))}
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    iconWrap: { width: 24, height: 24, alignItems: "center" as const, justifyContent: "center" as const },
    scrim: { backgroundColor: t.colors.overlay.scrimSoft },
    panel: {
      position: "absolute" as const,
      right: spacing.screenPadding - 4,
      width: PANEL_W,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: t.isDark ? 0.5 : 0.18,
      shadowRadius: 28,
      elevation: 16,
    },
    panelFill: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 18,
      backgroundColor: t.colors.surface.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    title: {
      fontSize: 12,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: 0.4,
      textTransform: "uppercase" as const,
      color: t.colors.text.tertiary,
      paddingHorizontal: 10,
      paddingTop: 6,
      paddingBottom: 4,
    },
    row: {
      minHeight: ROW_H,
      borderRadius: 12,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      paddingHorizontal: 10,
    },
    rowPressed: { backgroundColor: t.colors.fill.soft },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: t.colors.fill.subtle,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    rowText: { flex: 1, minWidth: 0 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border.subtle, marginVertical: 6, marginHorizontal: 10 },
    rowLabel: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    rowHint: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.violet, marginTop: 1 },
  });
