import { memo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { WtInviteDto } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PlainButton, PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Les invitations REÇUES : « X vous invite à regarder Y », « Accepter » /
 * « Refuser », et « Plus tard » qui referme sans répondre. La dernière
 * invitation honorée referme la feuille (le pendant de `InviteInboxModal`).
 */
export function WtInviteInboxSheet({ visible, invites, onClose, onRespond }: {
  visible: boolean;
  invites: readonly WtInviteDto[];
  onClose: () => void;
  onRespond: (inviteId: string, accept: boolean) => Promise<void>;
}) {
  const { t } = useTranslation("watchTogether");
  const s = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const respond = (inviteId: string, accept: boolean): void => {
    setBusy(inviteId);
    setFailed(false);
    onRespond(inviteId, accept).then(
      () => setBusy(null),
      () => { setBusy(null); setFailed(true); },
    );
  };

  return (
    <BottomSheet visible={visible && invites.length > 0} onClose={onClose} snapPoints={[0.5, 0.9]}>
      <ScrollView contentContainerStyle={s.content} testID="wt-invite-inbox">
        <Text style={s.title} accessibilityRole="header">{t("invitations")}</Text>
        {invites.map((invite) => (
          <InviteCard key={invite.inviteId} invite={invite} busy={busy === invite.inviteId} onRespond={respond} />
        ))}
        {failed && <Text style={s.error} accessibilityLiveRegion="polite">{t("errorGeneric")}</Text>}
        <PlainButton label={t("later")} onPress={onClose} fullWidth />
      </ScrollView>
    </BottomSheet>
  );
}

const InviteCard = memo(function InviteCard({ invite, busy, onRespond }: {
  invite: WtInviteDto;
  busy: boolean;
  onRespond: (inviteId: string, accept: boolean) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const s = useThemedStyles(makeStyles);
  const text = invite.itemName
    ? t("invitedByWithItem", { name: invite.fromUsername, title: invite.itemName })
    : t("invitedBy", { name: invite.fromUsername });
  return (
    <View style={s.card} testID={`wt-invite-${invite.inviteId}`}>
      <Text style={s.cardText}>{text}</Text>
      <View style={s.buttons}>
        <SecondaryButton label={t("decline")} onPress={() => onRespond(invite.inviteId, false)}
          disabled={busy} style={s.button} />
        <PrimaryButton label={t("accept")} onPress={() => onRespond(invite.inviteId, true)}
          loading={busy} disabled={busy} style={s.button} />
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  title: { color: t.colors.text.primary, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, marginBottom: 4 },
  card: { padding: 16, gap: 14, borderRadius: RADIUS.xl, backgroundColor: t.colors.fill.subtle },
  cardText: { color: t.colors.text.primary, fontSize: 16, lineHeight: 22, fontFamily: FONT_FAMILY.medium },
  buttons: { flexDirection: "row", gap: 10 },
  button: { flex: 1 },
  error: { color: t.colors.status.error, fontSize: 13, textAlign: "center", fontFamily: FONT_FAMILY.regular },
});
