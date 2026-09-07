import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, typography, useThemedStyles, type AppTheme } from "@/theme";
import { isReducedMotion } from "@/theme/motion";
import { ConnectivitySheet } from "./ConnectivitySheet";
import { useConnectivity } from "./useConnectivity";

interface Props {
  /** `header` : à la place du titre de l'en-tête ; `inline` : à côté d'un titre d'écran. */
  variant?: "header" | "inline";
}

/**
 * La pastille ambre « Hors ligne » — invisible en ligne, l'état standard ne
 * change pas d'un pixel. Un point qui pulse (fixe en mouvement réduit) ;
 * l'appui ouvre la bulle d'état et d'actions.
 */
export function ConnectivityPill({ variant = "header" }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { state } = useConnectivity();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const offline = state === "offline-auto" || state === "offline-manual";
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!offline || isReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [offline, pulse]);

  if (!offline) return null;
  const manual = state === "offline-manual";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={to("a11yPill")}
        style={({ pressed }) => [styles.pill, variant === "inline" && styles.pillInline, pressed && styles.pressed]}
      >
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.label} numberOfLines={1}>
          {t(manual ? "offlineChipManual" : "offlineChip")}
        </Text>
      </Pressable>
      <ConnectivitySheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: t.colors.statusPairs.warning.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    pillInline: { height: 24, paddingHorizontal: 8 },
    pressed: { opacity: 0.75 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.statusPairs.warning.fg,
    },
    label: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.statusPairs.warning.fg,
    },
  });
