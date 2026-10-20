import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { HeartHandshake, LogOut } from "lucide-react-native";
import type { WtAffinityStateDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { KIND_LABEL_KEY } from "@tentacle-tv/api-client";

/**
 * L'en-tête de la pile : le type et la taille de la pile (« Changer »),
 * « Quitter » NOMMÉ (la séance est partagée : à deux, la quitter la referme
 * chez l'autre), puis qui participe et combien chacun a jugé.
 */
export const AffinityHeaderNative = memo(function AffinityHeaderNative({ state, room, selfId, onChangeKind, onQuit }: {
  state: WtAffinityStateDto;
  room: WtRoomStateDto | null;
  selfId: string | null;
  onChangeKind: () => void;
  onQuit: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const judged = new Map(state.participants.map((p) => [p.userId, p.judged]));

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <View style={s.badge}><HeartHandshake size={20} color="#ffffff" /></View>
        <View style={s.text}>
          <Text style={s.title} accessibilityRole="header">{t("affinityTitle")}</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>
              {t(KIND_LABEL_KEY[state.kind])} · {t("affinityDeckCount", { count: state.deckSize })} ·{" "}
            </Text>
            <Pressable onPress={onChangeKind} accessibilityRole="button" hitSlop={12} testID="wt-affinity-change">
              <Text style={s.change}>{t("affinityChange")}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={onQuit} accessibilityRole="button" accessibilityLabel={t("affinityQuitLabel")}
          style={({ pressed }) => [s.quit, pressed && s.pressed]} testID="wt-affinity-quit">
          <LogOut size={16} color={theme.colors.text.primary} />
          <Text style={s.quitLabel}>{t("affinityQuit")}</Text>
        </Pressable>
      </View>
      {room && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.people}>
          {room.members.map((m) => {
            const count = judged.get(m.userId);
            const joined = count !== undefined;
            return (
              <View key={m.userId} style={[s.person, !joined && s.absent]}>
                <UserAvatar userId={m.userId} name={m.username} hasAvatar={m.hasAvatar} size={24} />
                <Text style={s.personName}>{m.userId === selfId ? t("affinityYou") : m.username}</Text>
                <Text style={s.personMeta}>{joined ? t("affinityJudged", { count }) : t("affinityNotJoined")}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.violet },
  text: { flex: 1, minWidth: 0 },
  title: { color: t.colors.text.primary, fontSize: 18, fontFamily: FONT_FAMILY.bold },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  meta: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  change: { color: t.colors.brand.light, fontSize: 13, fontFamily: FONT_FAMILY.semibold },
  quit: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill,
    backgroundColor: t.colors.fill.soft,
  },
  pressed: { opacity: 0.7 },
  quitLabel: { color: t.colors.text.primary, fontSize: 13, fontFamily: FONT_FAMILY.semibold },
  people: { gap: 8 },
  person: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 3, paddingRight: 10, paddingVertical: 3,
    borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  absent: { opacity: 0.6 },
  personName: { color: t.colors.text.primary, fontSize: 12, fontFamily: FONT_FAMILY.medium },
  personMeta: { color: t.colors.text.tertiary, fontSize: 12, fontFamily: FONT_FAMILY.regular, fontVariant: ["tabular-nums"] },
});
