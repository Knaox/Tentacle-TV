import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCancelFamilyInvitation, useDeleteFamilyGuest, useRemoveFamilyMember } from "@tentacle-tv/api-client";
import { FAMILY_LIMITS, ownedCounts, type FamilyOverviewDto, type FamilyProfileDto, type OutgoingInvitationDto } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import type { FamilyScreenModel } from "@/family/familyScreenModel";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { ctaGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { FamilyProfileRow } from "./FamilyProfileRow";
import { GuestSheet } from "./GuestSheet";
import { InviteSheet } from "./InviteSheet";
import { PendingInvitationsSection } from "./PendingInvitationsSection";
import { GuestPinSheet } from "./PinSheet";

/** Le temps qu'une alerte iOS se retire : présenter autre chose pendant sa
 *  sortie (feuille, seconde alerte) échoue sans bruit. */
const ALERT_SETTLE_MS = 350;
const afterAlert = (run: () => void) => setTimeout(run, ALERT_SETTLE_MS);

/**
 * « Ma famille » : les profils (le propriétaire en tête, puis les membres,
 * puis les invités), les deux gestes qui la font grandir — inviter un compte,
 * créer un invité —, puis les invitations en attente. Sans famille, un appel
 * à la créer : elle naît au premier invité ou à la première invitation. Tout
 * geste qui retire passe par une confirmation qui dit ce qu'il coûte.
 */
export function OwnedFamilySection({ overview, model }: { overview: FamilyOverviewDto; model: FamilyScreenModel }) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const st = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { errorText, codeText } = useFamilyText();
  const removeMember = useRemoveFamilyMember();
  const deleteGuest = useDeleteFamilyGuest();
  const cancelInvite = useCancelFamilyInvitation();
  const [sheet, setSheet] = useState<"invite" | "guest" | null>(null);
  const [pinGuest, setPinGuest] = useState<FamilyProfileDto | null>(null);

  const owned = overview.owned;
  const manage = model.personal;
  const counts = useMemo(() => ownedCounts(owned), [owned]);
  const failed = useCallback((error: unknown) => showToast({ title: errorText(error) }), [errorText]);

  const confirmRemove = useCallback((profile: FamilyProfileDto) => {
    Alert.alert(t("familyWeb:confirm.removeTitle", { name: profile.name }), t("familyWeb:confirm.removeBody"), [
      { text: t("familyWeb:cancel"), style: "cancel" },
      { text: t("familyWeb:confirm.removeAction"), style: "destructive", onPress: () => { haptic("destructive"); removeMember.mutate(profile.userId, { onError: failed }); } },
    ]);
  }, [t, removeMember, failed]);

  const confirmDeleteGuest = useCallback((profile: FamilyProfileDto) => {
    Alert.alert(t("familyWeb:confirm.deleteGuestTitle", { name: profile.name }), t("familyWeb:confirm.deleteGuestBody"), [
      { text: t("familyWeb:cancel"), style: "cancel" },
      { text: t("familyWeb:confirm.deleteGuestAction"), style: "destructive", onPress: () => { haptic("destructive"); deleteGuest.mutate(profile.userId, { onError: failed }); } },
    ]);
  }, [t, deleteGuest, failed]);

  // « Gérer » un invité : son code PIN, ou sa suppression (confirmée à part).
  const manageGuest = useCallback((profile: FamilyProfileDto) => {
    Alert.alert(t("familyMobile:manageTitle", { name: profile.name }), undefined, [
      { text: t("familyWeb:owned.setPin"), onPress: () => afterAlert(() => setPinGuest(profile)) },
      { text: t("familyWeb:owned.delete"), style: "destructive", onPress: () => afterAlert(() => confirmDeleteGuest(profile)) },
      { text: t("familyWeb:cancel"), style: "cancel" },
    ]);
  }, [t, confirmDeleteGuest]);

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
              canManage={manage}
              onRemove={confirmRemove}
              onManageGuest={manageGuest}
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
      {pinGuest ? <GuestPinSheet guest={pinGuest} onClose={() => setPinGuest(null)} /> : null}
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
