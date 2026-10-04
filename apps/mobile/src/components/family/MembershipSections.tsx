import { memo, useCallback } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useLeaveFamily } from "@tentacle-tv/api-client";
import type { FamilyMembershipDto, IncomingInvitationDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { SettingsSection } from "@/components/settings";
import { requestFamilyPoster } from "@/family/familyPosterStore";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { useTheme, useThemedStyles } from "@/theme";
import { haptic } from "@/utils/haptics";
import { makeFamilyRowStyles } from "./familyRowStyles";

/** Les invitations reçues : « Répondre » rouvre l'AFFICHE (même remise à plus
 *  tard) — une seule façon de répondre, qui dit ce qu'accepter implique. */
export function IncomingInvitationsSection({ incoming }: { incoming: IncomingInvitationDto[] }) {
  const { t } = useTranslation("familyWeb");
  const theme = useTheme();
  const st = useThemedStyles(makeFamilyRowStyles);
  const { formatDate } = useFamilyText();
  return (
    <SettingsSection title={t("incoming.title")}>
      {incoming.map((invitation, index) => (
        <View key={invitation.id} style={[st.row, index < incoming.length - 1 && st.bordered]}>
          <View style={st.iconBubble}>
            <Feather name="mail" size={18} color={theme.colors.brand.light} />
          </View>
          <View style={st.body}>
            <Text style={st.title}>{t("incoming.row", { owner: invitation.ownerName })}</Text>
            <Text style={st.metaText}>{t("incoming.expires", { date: formatDate(invitation.expiresAt) })}</Text>
          </View>
          <Pressable
            onPress={() => requestFamilyPoster(invitation.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t("incoming.open")} — ${t("incoming.row", { owner: invitation.ownerName })}`}
            style={({ pressed }) => [st.pill, pressed && st.dim]}
          >
            <Text style={st.actionText}>{t("incoming.open")}</Text>
          </Pressable>
        </View>
      ))}
    </SettingsSection>
  );
}

/** Les familles dont je suis membre : quitter, à tout moment, confirmé. */
export function MembershipsSection({ memberships, canLeave }: { memberships: FamilyMembershipDto[]; canLeave: boolean }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const leave = useLeaveFamily();

  const confirmLeave = useCallback((membership: FamilyMembershipDto) => {
    Alert.alert(t("confirm.leaveTitle", { owner: membership.ownerName }), t("confirm.leaveBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm.leaveAction"),
        style: "destructive",
        onPress: () => {
          haptic("destructive");
          leave.mutate(membership.familyId, { onError: (failure) => showToast({ title: errorText(failure) }) });
        },
      },
    ]);
  }, [t, leave, errorText]);

  return (
    <SettingsSection title={t("memberships.title")} caption={t("memberships.hint")}>
      {memberships.map((membership, index) => (
        <MembershipRow
          key={membership.familyId}
          membership={membership}
          last={index === memberships.length - 1}
          canLeave={canLeave}
          onLeave={confirmLeave}
        />
      ))}
    </SettingsSection>
  );
}

const MembershipRow = memo(function MembershipRow({ membership, last, canLeave, onLeave }: {
  membership: FamilyMembershipDto;
  last: boolean;
  canLeave: boolean;
  onLeave: (membership: FamilyMembershipDto) => void;
}) {
  const { t } = useTranslation("familyWeb");
  const st = useThemedStyles(makeFamilyRowStyles);
  const { formatDate } = useFamilyText();
  const label = t("memberships.row", { owner: membership.ownerName });
  return (
    <View style={[st.row, !last && st.bordered]}>
      <UserAvatar userId={membership.ownerUserId} name={membership.ownerName} hasAvatar size={40} />
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>{label}</Text>
        <Text style={st.metaText}>{t("memberships.since", { date: formatDate(membership.since) })}</Text>
      </View>
      {canLeave ? (
        <Pressable
          onPress={() => onLeave(membership)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("memberships.leave")} — ${label}`}
          style={({ pressed }) => [st.action, pressed && st.dim]}
        >
          <Text style={st.dangerText}>{t("memberships.leave")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
