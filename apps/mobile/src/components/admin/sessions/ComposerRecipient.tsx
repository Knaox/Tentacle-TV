import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { joinParts, type AdminSessionDto, type AdminWatchGroupDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { AppLabel } from "./AppLabel";
import { UserAvatar } from "./UserAvatar";

const STACK = 4;

/**
 * Le destinataire d'un message, sous l'en-tête de la rédaction : l'avatar,
 * l'application et l'appareil d'une session, ou les visages d'une salle — on
 * ne doit jamais se demander à qui l'on écrit.
 */
export function SessionRecipient({ session }: { session: AdminSessionDto }) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.row}>
      <UserAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={36} />
      <View style={st.text}>
        <Text style={st.name} numberOfLines={1}>{session.userName}</Text>
        <AppLabel session={session} style={st.detail} />
      </View>
    </View>
  );
}

export function GroupRecipient({ group }: { group: AdminWatchGroupDto }) {
  const { t } = useTranslation("sessions");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.row}>
      <View style={st.stack}>
        {group.members.slice(0, STACK).map((member, index) => (
          <View key={member.userId} style={[st.stacked, index > 0 && st.overlap]}>
            <UserAvatar userId={member.userId} name={member.userName} hasAvatar={member.hasAvatar} size={30} />
          </View>
        ))}
      </View>
      <View style={st.text}>
        <Text style={st.name} numberOfLines={1}>{t("groupOf", { count: group.members.length })}</Text>
        <Text style={st.detail} numberOfLines={1}>{joinParts([group.members.map((m) => m.userName).join(", ")])}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
    text: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    detail: { fontSize: 13, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, marginTop: 1 },
    stack: { flexDirection: "row" as const },
    stacked: { borderRadius: 17, borderWidth: 2, borderColor: t.colors.surface.s0 },
    overlap: { marginLeft: -10 },
  });
