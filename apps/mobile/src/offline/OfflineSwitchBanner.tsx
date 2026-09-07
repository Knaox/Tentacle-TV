import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  withAlpha,
  type AppTheme,
} from "@/theme";
import { ConnectivitySheet } from "./ConnectivitySheet";
import { offlineReasonKey } from "./offlineReasonText";
import { useConnectivity } from "./useConnectivity";
import { useHasLocalContent } from "./useOfflineMode";

/** Le temps de lire, puis le bandeau s'efface : ce n'est pas une alerte permanente. */
const VISIBLE_MS = 8_000;

/**
 * Le bandeau qui EXPLIQUE la bascule hors ligne.
 *
 * Jusqu'ici, un serveur qui cessait de répondre remplaçait l'accueil par le
 * catalogue local en silence : seule une pastille ambre apparaissait dans
 * l'en-tête, muette tant qu'on ne la touchait pas. On voyait sa bibliothèque
 * rétrécir sans savoir pourquoi.
 *
 * Il ne paraît qu'à la TRANSITION vers le hors ligne automatique, et seulement
 * s'il y a du contenu local — sans contenu, c'est le voile plein écran qui
 * s'affiche, avec ses actions. Jamais en mode manuel : l'utilisateur l'a
 * demandé lui-même. L'appui ouvre la bulle d'état, déjà branchée sur Réessayer
 * et Rester hors ligne, plutôt que d'en dupliquer les boutons.
 */
export function OfflineSwitchBanner() {
  const { state, reason } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Une fois par bascule : une connexion qui vacille ferait autrement clignoter
  // le bandeau à chaque aller-retour.
  const announced = useRef(false);

  useEffect(() => {
    if (state !== "offline-auto") {
      announced.current = false;
      setVisible(false);
      return;
    }
    // La liste locale répond après coup : tant qu'on ne sait pas, on attend
    // plutôt que d'annoncer une bascule qui va se transformer en voile.
    if (hasLocalContent !== true || announced.current) return;
    announced.current = true;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state, hasLocalContent]);

  const dismiss = useCallback(() => setVisible(false), []);
  const open = useCallback(() => {
    setVisible(false);
    setSheetOpen(true);
  }, []);

  return (
    <>
      {visible && (
        <Animated.View
          entering={FadeInUp.duration(280)}
          exiting={FadeOutUp.duration(200)}
          style={[st.wrap, { paddingTop: Math.max(insets.top, 24) + 8 }]}
          accessibilityRole="alert"
        >
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={to("switchedOfflineTitle")}>
            <View style={st.row}>
              <Feather name="cloud-off" size={18} color={theme.colors.status.warning} style={st.icon} />
              <View style={st.textWrap}>
                <Text style={st.title}>{to("switchedOfflineTitle")}</Text>
                <Text style={st.message}>
                  {t(offlineReasonKey(reason))} {to("switchedOfflineHint")}
                </Text>
              </View>
              <Pressable
                onPress={dismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={to("switchedOfflineDismiss")}
                style={st.close}
              >
                <Feather name="x" size={18} color={theme.colors.text.secondary} />
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      )}
      <ConnectivitySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 900,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.md,
      backgroundColor: t.colors.statusPairs.warning.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withAlpha(t.colors.status.warning, 0.35, t.colors.border.strong),
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: t.colors.surface.s1,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(t.colors.status.warning, 0.3, t.colors.border.strong),
      padding: spacing.md,
    },
    icon: { marginTop: 1 },
    textWrap: { flex: 1 },
    title: { ...typography.bodyBold, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    message: { ...typography.small, color: t.colors.text.secondary, marginTop: 3, lineHeight: 17 },
    close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  });
