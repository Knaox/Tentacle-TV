import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCancelFamilyInvitation, useUserId } from "@tentacle-tv/api-client";
import {
  FAMILY_LIMITS,
  familyCounts,
  isOwnProfile,
  profileActions,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type OutgoingInvitationDto,
  type ProfileActions,
} from "@tentacle-tv/shared";
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

const NO_PROFILES: readonly FamilyProfileDto[] = [];

/** Le profil a-t-il un panneau pour ce compte (un geste au moins) ? */
const hasPanel = (actions: ProfileActions) => actions.pin || actions.remove || actions.right !== null;

/**
 * LA famille de ce compte (v2, partagée) — « Ma famille » pour son
 * propriétaire, « Famille de X » pour un membre : tous les profils (le
 * propriétaire en tête, puis les membres, puis les invités), les gestes qui
 * la font grandir selon le rôle, puis les invitations en attente (le seul
 * propriétaire). Sans famille, un appel à la créer : elle naît au premier
 * invité ou à la première invitation. Un appui sur un profil qu'on gère ouvre
 * son panneau (`useProfilePanel`, gestes de `profileActions`).
 */
export function FamilySection({ overview, model }: { overview: FamilyOverviewDto; model: FamilyScreenModel }) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const st = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { errorText, codeText } = useFamilyText();
  const me = useUserId();
  const cancelInvite = useCancelFamilyInvitation();
  const [sheet, setSheet] = useState<"invite" | "guest" | null>(null);

  const family = overview.family;
  const counts = useMemo(() => familyCounts(family), [family]);
  const actionsOf = useCallback((profile: FamilyProfileDto) => profileActions(overview, profile, me), [overview, me]);
  const panel = useProfilePanel(family?.profiles ?? NO_PROFILES, actionsOf);

  const confirmCancel = useCallback((invitation: OutgoingInvitationDto) => {
    const name = invitation.inviteeName;
    Alert.alert(t("familyWeb:confirm.cancelInviteTitle", { name }), t("familyWeb:confirm.cancelInviteBody"), [
      { text: t("familyWeb:cancel"), style: "cancel" },
      {
        text: t("familyWeb:confirm.cancelInviteAction"),
        style: "destructive",
        onPress: () => cancelInvite.mutate(invitation.id, { onError: (e) => showToast({ title: errorText(e) }) }),
      },
    ]);
  }, [t, cancelInvite, errorText]);

  const title = !family || family.role === "owner"
    ? t("familyWeb:shared.titleOwner")
    : t("familyWeb:shared.titleMember", { owner: family.owner.name });
  const caption = [
    family && `${t("familyWeb:owned.capacity", { count: counts.profiles, max: FAMILY_LIMITS.profiles })} · ${t("familyWeb:owned.guests", { count: counts.guests, max: FAMILY_LIMITS.guests })}`,
    family?.role === "member" && t("familyWeb:shared.memberNotice", { owner: family.owner.name }),
    model.role === "member" && model.showAddGuest && t("familyMobile:memberMayCreate"),
    model.blocked && codeText(model.blocked),
  ].filter(Boolean).join("\n");
  const hasActions = model.showInvite || model.showAddGuest;
  const gradient = ctaGradient(theme.colors.brand);

  return (
    <>
      <SettingsSection title={title} caption={caption || undefined}>
        {family ? (
          family.profiles.map((profile, index) => (
            <FamilyProfileRow
              key={profile.userId}
              profile={profile}
              last={index === family.profiles.length - 1 && !hasActions}
              you={isOwnProfile(profile, me)}
              yours={family.role === "member" && profile.createdBy !== null && isOwnProfile({ userId: profile.createdBy }, me)}
              onOpen={hasPanel(actionsOf(profile)) ? panel.open : undefined}
            />
          ))
        ) : (
          <View style={[st.empty, hasActions && st.emptyBordered]}>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.emptyIcon}>
              <Feather name="users" size={22} color={theme.colors.cta.brandFg} />
            </LinearGradient>
            <View style={st.emptyBody}>
              <Text style={st.emptyTitle}>{t("familyWeb:owned.emptyTitle")}</Text>
              <Text style={st.emptyText}>{t("familyWeb:owned.emptyBody")}</Text>
            </View>
          </View>
        )}
        {model.showInvite ? (
          <SettingsRow
            icon="user-plus"
            label={t("familyWeb:owned.invite")}
            description={t("familyMobile:inviteHint")}
            accent
            chevron
            last={!model.showAddGuest}
            disabled={model.invite !== null}
            onPress={() => setSheet("invite")}
          />
        ) : null}
        {model.showAddGuest ? (
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
        ) : null}
      </SettingsSection>

      {model.showPending && family ? (
        <PendingInvitationsSection invitations={family.pendingInvitations} canManage={model.personal} onCancel={confirmCancel} />
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
