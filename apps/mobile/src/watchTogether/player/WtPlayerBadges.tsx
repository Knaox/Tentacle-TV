import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react-native";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";

/**
 * Le bouton du groupe dans la rangée d'outils du lecteur : l'icône, le
 * nombre de membres et, s'il y en a, la pastille des messages non lus. Il
 * ouvre (et referme) le panneau du groupe.
 */
export const WtGroupButton = memo(function WtGroupButton({ memberCount, unread, active, onPress, large }: {
  memberCount: number;
  unread: number;
  active: boolean;
  onPress: () => void;
  /** Contrôles agrandis (iPad). */
  large?: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const label = unread > 0 ? t("chatUnreadAria", { count: unread }) : t("chatOpenAria");
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityLabel={`${t("membersCount", { count: memberCount })} — ${label}`}
      style={[st.button, large && st.buttonLarge, active && st.buttonActive]}
      testID="wt-group-button"
    >
      <Users size={large ? 25 : 18} color={PLAYER.textSecondary} />
      <Text style={st.count}>{memberCount}</Text>
      {unread > 0 && <View style={st.dot} />}
    </Pressable>
  );
});

/**
 * La puce d'attente posée au centre haut de la vidéo — « X met en mémoire
 * tampon… », « Synchronisation… ». Toujours visible (information de
 * blocage), ne capte aucun toucher.
 */
export const WtWaitingChip = memo(function WtWaitingChip({ text }: { text: string }) {
  return (
    <View pointerEvents="none" style={st.chipWrap}>
      <View style={st.chip} accessibilityLiveRegion="polite" testID="wt-waiting">
        <ActivityIndicator size="small" color={PLAYER.text} />
        <Text style={st.chipText} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  button: {
    flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8,
    backgroundColor: PLAYER.borderSubtle,
  },
  buttonLarge: { padding: 12 },
  buttonActive: { backgroundColor: PLAYER.fillSoft },
  count: { color: PLAYER.textSecondary, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  dot: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: PLAYER.accent },
  chipWrap: { position: "absolute", top: 64, left: 0, right: 0, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: PLAYER.controlBgHeavy,
  },
  chipText: { color: PLAYER.text, fontSize: 14, fontFamily: FONT_FAMILY.medium },
});
