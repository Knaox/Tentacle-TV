import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { StoredUser } from "@/auth/storedUser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Badge } from "@/components/ui";
import { useOpenProfileSwitcher } from "@/components/settings/controls/AccountRows";
import { RADIUS, spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  user: StoredUser | null;
  userName: string;
  initial: string;
  isAdmin: boolean;
  serverUrl: string;
  /** La famille a plusieurs profils, en ligne : le bouton « Changer de profil » sous le nom. */
  canSwitchProfile?: boolean;
}

/** Le serveur tel qu'on le reconnaît : son hôte, sans schéma ni chemin. */
function serverHost(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
}

/**
 * L'identité en tête du profil : photo (ProfileAvatar, reprise telle
 * quelle), nom, badge administrateur, le serveur auquel on est relié, et —
 * dans une famille à plusieurs profils — « Changer de profil », à portée de
 * pouce (décision de Damien du 2026-10-20 : ultra simple ; la même chose que
 * la ligne de Compte).
 */
export function ProfileHero({ user, userName, initial, isAdmin, serverUrl, canSwitchProfile }: Props) {
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
        {canSwitchProfile ? <SwitchProfileButton /> : null}
      </View>
    </View>
  );
}

/** Le bouton secondaire, en capsule neutre : une action, pas la principale de l'écran. */
function SwitchProfileButton() {
  const { t } = useTranslation("settingsMobile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const open = useOpenProfileSwitcher();
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [st.switch, pressed && st.switchPressed]}
    >
      <Feather name="refresh-cw" size={13} color={theme.colors.text.primary} />
      <Text style={st.switchLabel}>{t("account.switchProfile")}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.lg, marginBottom: spacing.xl },
  text: { flex: 1, gap: 4 },
  name: { ...typography.title, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
  sub: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  badge: { flexDirection: "row" as const },
  switch: {
    flexDirection: "row" as const, alignItems: "center" as const, alignSelf: "flex-start" as const, gap: 6,
    minHeight: 32, paddingHorizontal: spacing.md, marginTop: spacing.xs,
    borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.subtle,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  switchPressed: { opacity: 0.7 },
  switchLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
});
