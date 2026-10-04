import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { OutgoingInvitationDto } from "@tentacle-tv/shared";
import { SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { useTheme, useThemedStyles } from "@/theme";
import { makeFamilyRowStyles } from "./familyRowStyles";

/** Les invitations que j'ai envoyées et qui attendent : chacune réserve sa
 *  place dans la famille ; l'annuler la retire de la cloche du destinataire. */
export function PendingInvitationsSection({ invitations, canManage, onCancel }: {
  invitations: OutgoingInvitationDto[];
  canManage: boolean;
  onCancel: (invitation: OutgoingInvitationDto) => void;
}) {
  const { t } = useTranslation("familyWeb");
  return (
    <SettingsSection title={t("owned.pendingTitle")}>
      {invitations.map((invitation, index) => (
        <PendingRow
          key={invitation.id}
          invitation={invitation}
          last={index === invitations.length - 1}
          canManage={canManage}
          onCancel={onCancel}
        />
      ))}
    </SettingsSection>
  );
}

const PendingRow = memo(function PendingRow({ invitation, last, canManage, onCancel }: {
  invitation: OutgoingInvitationDto;
  last: boolean;
  canManage: boolean;
  onCancel: (invitation: OutgoingInvitationDto) => void;
}) {
  const { t } = useTranslation("familyWeb");
  const theme = useTheme();
  const st = useThemedStyles(makeFamilyRowStyles);
  const { formatDate } = useFamilyText();
  return (
    <View style={[st.row, !last && st.bordered]}>
      <View style={st.iconBubble}>
        <Feather name="clock" size={18} color={theme.colors.brand.light} />
      </View>
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>{invitation.inviteeName}</Text>
        <Text style={st.metaText}>
          {t("owned.pendingRow", { sent: formatDate(invitation.createdAt), expires: formatDate(invitation.expiresAt) })}
        </Text>
      </View>
      {canManage ? (
        <Pressable
          onPress={() => onCancel(invitation)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("owned.cancelInvite")} — ${invitation.inviteeName}`}
          style={({ pressed }) => [st.action, pressed && st.dim]}
        >
          <Text style={st.dangerText}>{t("owned.cancelInvite")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
