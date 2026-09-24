import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { buttonStatus, type AdminSessionDto, type Feedback } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ActionPill } from "./ActionPill";
import { AppLabel } from "./AppLabel";
import { UserAvatar } from "./UserAvatar";

/** « à l'instant », « il y a 3 min » — Hermes n'a pas `Intl.RelativeTimeFormat`. */
function relativeTime(t: TFunction, iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds) || seconds < 60) return t("agoNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("agoMinutes", { count: minutes });
  return t("agoHours", { count: Math.round(minutes / 60) });
}

/**
 * Les appareils connectés qui ne lisent rien : une ligne chacun, compacte —
 * on les voit, on peut leur écrire, ils ne volent pas la place des lectures.
 */
export const IdleSessions = memo(function IdleSessions({ sessions, now, feedback, onMessage }: {
  sessions: AdminSessionDto[];
  now: number;
  feedback: ReadonlyMap<string, Feedback>;
  onMessage: (session: AdminSessionDto) => void;
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.list}>
      {sessions.map((session, index) => (
        <View key={session.id} style={[st.row, index > 0 && st.divider]}>
          <UserAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={34} />
          <View style={st.text}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>{session.userName}</Text>
              {session.viaTentacle && <Feather name="radio" size={12} color={theme.colors.brand.light} accessibilityLabel={t("viaTentacle")} />}
            </View>
            <AppLabel session={session} style={st.app} />
            {/* Sa propre ligne : au bout de l'appareil, elle était la première tronquée. */}
            <Text style={st.active} numberOfLines={1}>
              {t("lastActive", { time: relativeTime(t, session.lastActivity, now) })}
            </Text>
          </View>
          {session.supportsRemoteControl && (
            <ActionPill
              iconOnly
              icon="message-square"
              label={`${t("message")} — ${session.userName}`}
              tone="brand"
              status={buttonStatus(feedback.get(session.id), ["message"])}
              onPress={() => onMessage(session)}
            />
          )}
        </View>
      ))}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
      overflow: "hidden" as const,
    },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border.subtle },
    text: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
    name: { flexShrink: 1, fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    app: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, marginTop: 1 },
    active: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary, marginTop: 1 },
  });
