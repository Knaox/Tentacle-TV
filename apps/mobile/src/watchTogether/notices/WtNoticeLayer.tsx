import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WtChatMessageDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";
import { useWtNotices, type WtNoticeKind } from "./wtNotices";

const DOT: Record<WtNoticeKind, string> = { success: PLAYER.accent, error: PLAYER.error, info: PLAYER.textSecondary };

/**
 * Les messages du groupe DANS le lecteur, en bas à gauche, au-dessus de la
 * barre : les faits (« X a mis en pause ») et les aperçus des messages de
 * chat reçus panneau fermé. Lus par VoiceOver sans voler le focus ; aucun
 * toucher capté.
 */
export const WtNoticeLayer = memo(function WtNoticeLayer({ chatToasts }: { chatToasts: readonly WtChatMessageDto[] }) {
  const notices = useWtNotices();
  const insets = useSafeAreaInsets();
  if (notices.length === 0 && chatToasts.length === 0) return null;
  return (
    <View pointerEvents="none" style={[st.layer, { left: 16 + insets.left, bottom: 140 + insets.bottom }]}>
      {notices.map((n) => (
        <View key={`n${n.id}`} style={st.card} accessibilityLiveRegion="polite">
          <View style={[st.dot, { backgroundColor: DOT[n.kind] }]} />
          <Text style={st.text} numberOfLines={2}>{n.text}</Text>
        </View>
      ))}
      {chatToasts.map((m) => (
        <View key={`c${m.id}`} style={st.card} accessibilityLiveRegion="polite">
          <Text style={st.text} numberOfLines={2}>
            <Text style={st.author}>{m.username} </Text>
            {m.text}
          </Text>
        </View>
      ))}
    </View>
  );
});

const st = StyleSheet.create({
  layer: { position: "absolute", maxWidth: 360, gap: 6 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.lg, backgroundColor: PLAYER.controlBgHeavy,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flexShrink: 1, color: PLAYER.text, fontSize: 14, lineHeight: 19, fontFamily: FONT_FAMILY.regular },
  author: { fontFamily: FONT_FAMILY.semibold },
});
