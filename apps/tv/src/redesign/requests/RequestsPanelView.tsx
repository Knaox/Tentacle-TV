import { memo, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { BackButton } from "../controls/BackButton";
import { GlassSurface } from "../glass/GlassSurface";
import { useNativeGlassBacking } from "../glass/glassBacking";
import { Icon } from "../icons/Icon";
import { usePresence } from "../motion/useMotion";
import { SWAP_FLOOR } from "../motion/useSwap";
import { colors, fonts, scrim } from "../theme/tokens";
import { RequestRow, ROW_GAP, ROW_PITCH } from "./RequestRow";
import type { RequestItemModel } from "./requestTypes";
import { useLeavingItems } from "./useLeavingItems";

/**
 * « Mes demandes », en grand : le MÊME panneau que celui de l'appui maintenu
 * sur une carte (`ActionSheetView`) — centré, verre dense, sur le même voile —,
 * un peu plus large pour se lire de loin. La croix Retour dans son coin, le
 * titre et le nombre, puis la liste, en lecture seule (`RequestRow`).
 *
 * Vue pure. Contrat :
 * - `items` : `null` tant qu'ils ne sont pas lus ; vide : « Vous n'avez rien
 *   en file d'attente. » ;
 * - une demande qui disparaît des données (arrivée) sort en douceur ;
 * - `closing` joue la sortie, puis `onClosed` — c'est alors seulement que le
 *   câblage retire sa `Modal`.
 *
 * Focus (câblage) : la croix `requests:close`, seule action — elle prend
 * l'entrée ; les lignes `requests:row:<clé>` ne deviennent focalisables que
 * pour faire défiler une liste qui dépasse (`REQUESTS_VISIBLE_ROWS`).
 */

export const REQUESTS_CLOSE_KEY = "requests:close";
/** Au-delà de ce nombre de lignes, la liste défile : elle en montre quatre et demie. */
export const REQUESTS_VISIBLE_ROWS = 4;

const WIDTH = 1320;
const PAD = 56;
const LIST_MAX = ROW_PITCH * (REQUESTS_VISIBLE_ROWS + 0.5);
/** Une demande arrivée s'efface en ce temps, puis s'en va. */
const LEAVING_MS = TV_MOTION.overlay.veilOutMs + 220;

export interface RequestsPanelViewProps {
  title: string;
  /** « 3 demandes » ; `null` : rien à compter. */
  subtitle: string | null;
  items: RequestItemModel[] | null;
  emptyText: string;
  loadingText: string;
  onClose?: () => void;
  closing?: boolean;
  onClosed?: () => void;
}

export const RequestsPanelView = memo(function RequestsPanelView({
  title,
  subtitle,
  items,
  emptyText,
  loadingText,
  onClose,
  closing = false,
  onClosed,
}: RequestsPanelViewProps) {
  const { rise, veil } = usePanelMotion(closing, onClosed);
  const backing = useNativeGlassBacking("strong");
  const rows = useLeavingItems(items, LEAVING_MS);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      {/* `box-none`, jamais `none` : sur tvOS, un parent qui refuse les
          interactions rend ses enfants infocalisables. */}
      <View pointerEvents="box-none" style={styles.center}>
        <Animated.View style={[styles.frame, rise]}>
          <View style={[styles.base, backing]} />
          <GlassSurface radius={TV_STAGE.radius.sheet} tone="strong" elevated style={styles.panel}>
            <View style={styles.header}>
              <View style={styles.back}>
                <BackButton focusKey={REQUESTS_CLOSE_KEY} onPress={onClose} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
            </View>
            {items === null ? <Message icon={null} text={loadingText} /> : null}
            {items !== null && rows.length === 0 ? <Message icon="inbox" text={emptyText} /> : null}
            {rows.length > 0 ? (
              <ScrollView style={{ maxHeight: LIST_MAX }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {rows.map((row, index) => (
                  <RequestRow key={row.item.key} item={row.item} index={index} leaving={row.leaving} fresh={row.fresh} />
                ))}
              </ScrollView>
            ) : null}
          </GlassSurface>
        </Animated.View>
      </View>
    </View>
  );
});

function Message({ icon, text }: { icon: "inbox" | null; text: string }) {
  return (
    <View style={styles.message}>
      {icon ? <Icon name={icon} size={64} color={colors.textTertiary} strokeWidth={1.6} /> : null}
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

/** Le même mouvement que le grand panneau : il surgit sur le ressort `panel`,
 *  le voile en fondu ; la fin de la sortie du voile appelle `onClosed`. */
function usePanelMotion(closing: boolean, onClosed?: () => void) {
  const panel = usePresence(!closing, "panel");
  const veil = usePresence(!closing, "veil");
  useEffect(() => {
    if (!veil.mounted) onClosed?.();
  }, [veil.mounted, onClosed]);
  const from = TV_MOTION.overlay.panelScale;
  const p = panel.progress;
  const v = veil.progress;
  return {
    // Jamais tout à fait 0 : tvOS tiendrait pour cachés ses focalisables (`SWAP_FLOOR`).
    rise: useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(SWAP_FLOOR, p.value)), transform: [{ scale: from + (1 - from) * p.value }] })),
    veil: useAnimatedStyle(() => ({ opacity: v.value })),
  };
}

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(0.72) },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: WIDTH },
  base: { ...StyleSheet.absoluteFillObject, borderRadius: TV_STAGE.radius.sheet, backgroundColor: "rgba(12, 12, 16, 0.95)" },
  panel: { paddingHorizontal: PAD, paddingVertical: 44, gap: 34 },
  header: { flexDirection: "row", alignItems: "center", gap: 24 },
  back: { alignSelf: "flex-start" },
  headerText: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 40, lineHeight: 46, color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 26, color: colors.textTertiary },
  list: { gap: ROW_GAP },
  message: { alignItems: "center", justifyContent: "center", gap: 22, paddingVertical: 56 },
  messageText: { ...fonts.semibold, fontSize: 32, color: colors.textSecondary, textAlign: "center" },
});
