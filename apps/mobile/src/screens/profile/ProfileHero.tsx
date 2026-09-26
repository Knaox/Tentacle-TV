import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { StoredUser } from "@/auth/storedUser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Badge } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  user: StoredUser | null;
  userName: string;
  initial: string;
  isAdmin: boolean;
  serverUrl: string;
}

/** Le serveur tel qu'on le reconnaît : son hôte, sans schéma ni chemin. */
function serverHost(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
}

/**
 * L'identité en tête du profil : photo (ProfileAvatar, reprise telle
 * quelle), nom, badge administrateur, et le serveur auquel on est relié.
 */
export function ProfileHero({ user, userName, initial, isAdmin, serverUrl }: Props) {
  const { t } = useTranslation("profile");
  const st = useThemedStyles(makeStyles);
  const host = serverHost(serverUrl);
  return (
    <View style={st.hero}>
      <ProfileAvatar user={user} initial={initial} />
      <View style={st.text}>
        <Text style={st.name} numberOfLines={1} accessibilityRole="header">{userName}</Text>
        {host ? <Text style={st.sub} numberOfLines={1}>{host}</Text> : null}
        {isAdmin ? <View style={st.badge}><Badge label={t("adminBadge")} variant="brand" /></View> : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.lg, marginBottom: spacing.xl },
  text: { flex: 1, gap: 4 },
  name: { ...typography.title, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
  sub: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  badge: { flexDirection: "row" as const },
});
