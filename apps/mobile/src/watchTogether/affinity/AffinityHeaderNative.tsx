import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { HeartHandshake } from "lucide-react-native";
import type { WtAffinityStateDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { SecondaryButton } from "@/components/ui/buttons";
import { FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";
import { KIND_LABEL_KEY } from "@tentacle-tv/shared";

/**
 * L'en-tête de la pile : le type et la taille de la pile (« Changer »),
 * « Quitter » NOMMÉ (la séance est partagée : à deux, la quitter la referme
 * chez l'autre), puis qui participe et combien chacun a jugé. `large` :
 * les tailles de l'iPad (titre, pastilles des membres).
 */
export const AffinityHeaderNative = memo(function AffinityHeaderNative({ state, room, selfId, onChangeKind, onQuit, large = false }: {
  state: WtAffinityStateDto;
  room: WtRoomStateDto | null;
  selfId: string | null;
  onChangeKind: () => void;
  onQuit: () => void;
  large?: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const s = useThemedStyles(makeStyles);
  const judged = new Map(state.participants.map((p) => [p.userId, p.judged]));

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <View style={[s.badge, large && s.badgeLarge]}><HeartHandshake size={large ? 24 : 20} color="#ffffff" /></View>
        <View style={s.text}>
          <Text style={[s.title, large && s.titleLarge]} accessibilityRole="header">{t("affinityTitle")}</Text>
          <View style={s.metaRow}>
            <Text style={[s.meta, large && s.metaLarge]}>
              {t(KIND_LABEL_KEY[state.kind])} · {t("affinityDeckCount", { count: state.deckSize })} ·{" "}
            </Text>
            <Pressable onPress={onChangeKind} accessibilityRole="button" hitSlop={12} testID="wt-affinity-change">
              <Text style={[s.change, large && s.metaLarge]}>{t("affinityChange")}</Text>
            </Pressable>
          </View>
        </View>
        <SecondaryButton label={t("affinityQuit")} icon="log-out" onPress={onQuit} size="sm"
          accessibilityLabel={t("affinityQuitLabel")} testID="wt-affinity-quit" />
      </View>
      {room && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.people}>
          {room.members.map((m) => {
            const count = judged.get(m.userId);
            const joined = count !== undefined;
            return (
              <View key={m.userId} style={[s.person, large && s.personLarge, !joined && s.absent]}>
                <UserAvatar userId={m.userId} name={m.username} hasAvatar={m.hasAvatar} size={large ? 32 : 24} />
                <Text style={[s.personName, large && s.personTextLarge]}>{m.userId === selfId ? t("affinityYou") : m.username}</Text>
                <Text style={[s.personMeta, large && s.personTextLarge]}>{joined ? t("affinityJudged", { count }) : t("affinityNotJoined")}</Text>
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
  people: { gap: 8 },
  person: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 3, paddingRight: 10, paddingVertical: 3,
    borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.faint, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  absent: { opacity: 0.6 },
  badgeLarge: { width: 48, height: 48 },
  titleLarge: { fontSize: 22 },
  metaLarge: { fontSize: 15 },
  personLarge: { gap: 8, paddingRight: 14, paddingVertical: 4 },
  personTextLarge: { fontSize: 14 },
  personName: { color: t.colors.text.primary, fontSize: 12, fontFamily: FONT_FAMILY.medium },
  personMeta: { color: t.colors.text.tertiary, fontSize: 12, fontFamily: FONT_FAMILY.regular, fontVariant: ["tabular-nums"] },
});
