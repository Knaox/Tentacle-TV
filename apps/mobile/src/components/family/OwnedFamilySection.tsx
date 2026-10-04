import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCancelFamilyInvitation } from "@tentacle-tv/api-client";
import { FAMILY_LIMITS, ownedCounts, type FamilyOverviewDto, type FamilyProfileDto, type OutgoingInvitationDto } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import type { FamilyScreenModel } from "@/family/familyScreenModel";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { ctaGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { FamilyProfileRow } from "./FamilyProfileRow";
import { GuestSheet } from "./GuestSheet";
import { InviteSheet } from "./InviteSheet";
import { PendingInvitationsSection } from "./PendingInvitationsSection";
import { useProfilePanel } from "./useProfilePanel";

/**
 * « Ma famille » : les profils (le propriétaire en tête, puis les membres,
 * puis les invités), les deux gestes qui la font grandir — inviter un compte,
 * créer un invité —, puis les invitations en attente. Sans famille, un appel
 * à la créer : elle naît au premier invité ou à la première invitation. Un
 * appui sur un profil ouvre son panneau (`useProfilePanel`) ; tout geste qui
 * retire passe par une confirmation qui dit ce qu'il coûte.
 */
export function OwnedFamilySection({ overview, model }: { overview: FamilyOverviewDto; model: FamilyScreenModel }) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const st = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { errorText, codeText } = useFamilyText();
  const cancelInvite = useCancelFamilyInvitation();
  const [sheet, setSheet] = useState<"invite" | "guest" | null>(null);

  const owned = overview.owned;
  const manage = model.personal;
  const counts = useMemo(() => ownedCounts(owned), [owned]);
  const failed = useCallback((error: unknown) => showToast({ title: errorText(error) }), [errorText]);
  // Le propriétaire gère chaque profil sauf le sien : le PIN d'un invité, retirer ou supprimer.
  const panel = useProfilePanel(useCallback((profile: FamilyProfileDto) => ({
    pin: profile.kind === "guest",
    remove: profile.kind !== "owner",
  }), []));

  const confirmCancel = useCallback((invitation: OutgoingInvitationDto) => {
    const name = invitation.inviteeName;
    Alert.alert(t("familyWeb:confirm.cancelInviteTitle", { name }), t("familyWeb:confirm.cancelInviteBody"), [
      { text: t("familyWeb:cancel"), style: "cancel" },
      { text: t("familyWeb:confirm.cancelInviteAction"), style: "destructive", onPress: () => cancelInvite.mutate(invitation.id, { onError: failed }) },
    ]);
  }, [t, cancelInvite, failed]);

  const caption = [
    owned && `${t("familyWeb:owned.capacity", { count: counts.profiles, max: FAMILY_LIMITS.profiles })} · ${t("familyWeb:owned.guests", { count: counts.guests, max: FAMILY_LIMITS.guests })}`,
    manage && model.blocked && codeText(model.blocked),
  ].filter(Boolean).join("\n");
  const gradient = ctaGradient(theme.colors.brand);

  return (
    <>
      <SettingsSection title={t("familyWeb:owned.title")} caption={caption || undefined}>
        {owned ? (
          owned.profiles.map((profile, index) => (
            <FamilyProfileRow
              key={profile.userId}
              profile={profile}
              last={index === owned.profiles.length - 1 && !manage}
              onOpen={manage && profile.kind !== "owner" ? panel.open : undefined}
            />
          ))
        ) : (
          <View style={[st.empty, manage && st.emptyBordered]}>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.emptyIcon}>
              <Feather name="users" size={22} color={theme.colors.cta.brandFg} />
            </LinearGradient>
            <View style={st.emptyBody}>
              <Text style={st.emptyTitle}>{t("familyWeb:owned.emptyTitle")}</Text>
              <Text style={st.emptyText}>{t("familyWeb:owned.emptyBody")}</Text>
            </View>
          </View>
        )}
        {manage ? (
          <>
            <SettingsRow
              icon="user-plus"
              label={t("familyWeb:owned.invite")}
              description={t("familyMobile:inviteHint")}
              accent
              chevron
              disabled={model.invite !== null}
              onPress={() => setSheet("invite")}
            />
            <SettingsRow
              icon="smile"
              label={t("familyWeb:owned.addGuest")}
              description={t("familyMobile:addGuestHint")}
              accent
              chevron
              last
              disabled={model.addGuest !== null}
              onPress={() => setSheet("guest")}
            />
          </>
        ) : null}
      </SettingsSection>

      {owned && owned.pendingInvitations.length > 0 ? (
        <PendingInvitationsSection invitations={owned.pendingInvitations} canManage={manage} onCancel={confirmCancel} />
      ) : null}

      {sheet === "invite" ? <InviteSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "guest" ? <GuestSheet onClose={() => setSheet(null)} /> : null}
      {panel.element}
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    empty: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg },
    emptyBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
    emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    emptyBody: { flex: 1 },
    emptyTitle: { ...typography.bodyBold, color: t.colors.text.primary },
    emptyText: { ...typography.small, color: t.colors.text.tertiary, marginTop: 4, lineHeight: 18 },
  });
