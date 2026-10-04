import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { IncomingInvitationDto } from "@tentacle-tv/shared";
import { SettingsSection } from "@/components/settings";
import { requestFamilyPoster } from "@/family/familyPosterStore";
import { useFamilyText } from "@/family/useFamilyText";
import { useTheme, useThemedStyles } from "@/theme";
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
