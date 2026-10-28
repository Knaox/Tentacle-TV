/**
 * Octave mobile — l'AVIS des gestes, en pastille de verre au-dessus du
 * mini-lecteur : arrivée en ressort par le bas, sortie plus rapide, une action
 * possible (« Changer »), annoncé aux lecteurs d'écran sans voler le focus.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveChrome } from "../../shell/octaveChrome";
import { dismissNotice, useNotice } from "../env/notices";
import { accentTextOf } from "../ui/pageStyle";


export function NoticeHost() {
  const notice = useNotice();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Au-dessus de la barre d'onglets et du mini-lecteur mesurés par la coquille.
  const above = Math.max(useOctaveChrome().bottomInset, insets.bottom + 24);
  if (!notice) return null;
  const Icon = notice.kind === "error" ? XCircle : notice.kind === "success" ? CheckCircle2 : Info;
  const tone = notice.kind === "error" ? theme.colors.status.error : accentTextOf(theme);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer, { paddingBottom: above }]}>
      <Animated.View key={notice.id} entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(160)} style={styles.wrap} accessibilityLiveRegion="polite">
        {/* Voile + flou, jamais le verre natif d'iOS 26 : trop clair, l'avis se lisait par-dessus la liste. */}
        <GlassSurface tier="dropdown" tint="strong" radius={18} liquid={false} style={styles.pill}>
          <Icon size={18} color={tone} />
          <View style={styles.text}>
            {notice.title ? <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{notice.title}</Text> : null}
            <Text style={[typography.caption, { color: theme.colors.text.secondary }]}>{notice.message}</Text>
          </View>
          {notice.action ? (
            <Pressable
              onPress={() => {
                dismissNotice();
                notice.action?.onPress();
              }}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.action}
            >
              <Text style={[typography.bodyBold, { color: accentTextOf(theme) }]}>{notice.action.label}</Text>
            </Pressable>
          ) : null}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { justifyContent: "flex-end", alignItems: "center", zIndex: 50 },
  wrap: { maxWidth: 520, width: "92%" },
  pill: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  action: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
});
