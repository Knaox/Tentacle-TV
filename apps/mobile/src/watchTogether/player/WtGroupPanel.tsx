import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Settings2, X } from "lucide-react-native";
import type { WtChatMessageDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";
import { MEMBER_STATE_LABEL, roomMemberRows, type WtMemberState } from "../model/roomModel";
import { WtChatPanel } from "../chat/WtChatPanel";

export type WtGroupPanelTab = "group" | "chat";

/** Le point d'état, sur la vidéo (couleurs fixes du lecteur) — doublé du mot. */
const STATE_DOT: Record<WtMemberState, string> = {
  error: PLAYER.error, buffering: PLAYER.warning, watching: PLAYER.accent, online: PLAYER.textSecondary, offline: PLAYER.textDim,
};

/**
 * Le panneau du groupe dans le lecteur : deux onglets, « Groupe » (qui est
 * là, ce que fait chacun) et « Chat du groupe ». Le même dans les quatre
 * dispositions (`groupPanelLayout`) ; la gestion (inviter, expulser,
 * quitter) reste dans la feuille du groupe, ouverte par « Voir le groupe ».
 */
export const WtGroupPanel = memo(function WtGroupPanel(props: {
  tab: WtGroupPanelTab;
  onTab: (tab: WtGroupPanelTab) => void;
  room: WtRoomStateDto;
  selfId: string | null;
  unread: number;
  messages: readonly WtChatMessageDto[];
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
  onOpenRoom: () => void;
  /** Absent : le panneau ne se ferme pas d'ici (la feuille a son geste). */
  onClose?: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const { tab, onTab, room, selfId } = props;
  const rows = useMemo(() => roomMemberRows(room, selfId), [room, selfId]);

  return (
    <View style={st.panel} testID="wt-group-panel">
      <View style={st.header}>
        <View style={st.tabs} accessibilityRole="tablist">
          <Tab label={t("yourGroup")} active={tab === "group"} onPress={() => onTab("group")} testID="wt-tab-group" />
          <Tab label={t("chatTitle")} active={tab === "chat"} onPress={() => onTab("chat")} badge={props.unread} testID="wt-tab-chat" />
        </View>
        {props.onClose && (
          <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel={t("close")} style={st.icon}>
            <X size={20} color={PLAYER.textSecondary} />
          </Pressable>
        )}
      </View>
      {tab === "chat" ? (
        <WtChatPanel messages={props.messages} selfId={selfId} onSend={props.onSend} onReact={props.onReact} />
      ) : (
        <ScrollView contentContainerStyle={st.members}>
          {rows.map(({ member, isSelf, state }) => (
            <View key={member.userId} style={st.member} accessible
              accessibilityLabel={`${member.username}, ${t(MEMBER_STATE_LABEL[state])}`}>
              <UserAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={36} />
              <View style={st.memberText}>
                <Text style={st.name} numberOfLines={1}>
                  {member.username}{isSelf ? ` (${t("you")})` : ""}{member.isHost ? ` · ${t("host")}` : ""}
                </Text>
                <View style={st.stateLine}>
                  <View style={[st.dot, { backgroundColor: STATE_DOT[state] }]} />
                  <Text style={st.state} numberOfLines={1}>{t(MEMBER_STATE_LABEL[state])}</Text>
                </View>
              </View>
            </View>
          ))}
          <Pressable onPress={props.onOpenRoom} accessibilityRole="button" style={st.manage} testID="wt-open-room">
            <Settings2 size={18} color={PLAYER.text} />
            <Text style={st.manageLabel}>{t("openRoom")}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
});

function Tab({ label, active, onPress, badge = 0, testID }: {
  label: string; active: boolean; onPress: () => void; badge?: number; testID: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}
      style={[st.tab, active && st.tabActive]} testID={testID}>
      <Text style={[st.tabLabel, active && st.tabLabelActive]} numberOfLines={1}>{label}</Text>
      {badge > 0 && !active && <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? "9+" : badge}</Text></View>}
    </Pressable>
  );
}

const st = StyleSheet.create({
  panel: { flex: 1, minHeight: 0, backgroundColor: PLAYER.controlBgHeavy },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 8, gap: 4 },
  tabs: { flex: 1, flexDirection: "row", gap: 4, padding: 3, borderRadius: RADIUS.pill, backgroundColor: PLAYER.fillSubtle },
  tab: { flex: 1, minHeight: 40, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill },
  tabActive: { backgroundColor: PLAYER.fillSoft },
  tabLabel: { color: PLAYER.textTertiary, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  tabLabelActive: { color: PLAYER.text },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: PLAYER.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: PLAYER.text, fontSize: 11, fontFamily: FONT_FAMILY.bold },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  members: { padding: 12, gap: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  memberText: { flex: 1, minWidth: 0 },
  name: { color: PLAYER.text, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  stateLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { color: PLAYER.textTertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  manage: {
    marginTop: 12, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: RADIUS.lg, backgroundColor: PLAYER.fillSoft,
  },
  manageLabel: { color: PLAYER.text, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
});
