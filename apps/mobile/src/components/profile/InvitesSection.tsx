import { useState } from "react";
import { View, Text, Pressable, Share, Platform, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SettingsChoiceRow, SettingsRow, SettingsSection } from "@/components/settings";
import { isInviteActive, useInvites, type InviteKey } from "@/hooks/admin/useInvites";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const MAX_USES_LIMIT = 50;
const VALIDITY_DAYS = ["1", "3", "7"] as const;

/**
 * Les invitations (admin) : une carte pour en créer une — nombre
 * d'utilisations au pas-à-pas, validité en segmenté, « Générer » en ligne
 * d'action — puis la liste, les actives avec leur partage, les expirées ou
 * épuisées estompées. Plus de champs numériques à saisir au pouce.
 */
export function InvitesSection() {
  const { t } = useTranslation("profile");
  const { invites, creating, create, serverUrl } = useInvites();
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState<string>("3");

  const share = (key: string, anchor?: number) => {
    const url = `${serverUrl}/register?invite=${key}`;
    // Sur iPad la feuille de partage est un popover → l'ancrer sur le bouton pressé.
    void Share.share(
      { message: t("shareInviteMessage", { url }) },
      Platform.OS === "ios" && anchor != null && Number.isFinite(anchor) ? { anchor } : undefined,
    );
  };

  return (
    <>
      <SettingsSection title={t("generateInvite")}>
        <SettingsRow
          icon="users"
          label={t("maxUses")}
          trailing={<Stepper value={maxUses} onChange={setMaxUses} label={t("maxUses")} />}
        />
        <SettingsChoiceRow
          icon="clock"
          label={t("inviteValidity")}
          options={VALIDITY_DAYS.map((value) => ({ value, label: t("inviteDays", { count: Number(value) }) }))}
          value={days}
          onChange={setDays}
        />
        <SettingsRow
          icon="plus-circle"
          label={t("generate")}
          accent
          last
          disabled={creating}
          onPress={() => void create(maxUses, Number(days) * 24)}
        />
      </SettingsSection>

      {/* Tant que la liste n'est pas lue (ou refusée), pas de carte vide. */}
      {invites && (
        <SettingsSection title={t("invitations")}>
          {invites.length === 0 && <SettingsRow icon="info" label={t("inviteNone")} last />}
          {invites.map((invite, index) => (
            <InviteRow key={invite.id} invite={invite} last={index === invites.length - 1} onShare={share} />
          ))}
        </SettingsSection>
      )}
    </>
  );
}

function InviteRow({ invite, last, onShare }: { invite: InviteKey; last: boolean; onShare: (key: string, anchor?: number) => void }) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const active = isInviteActive(invite);
  const expired = invite.expiresAt ? new Date(invite.expiresAt) < new Date() : false;
  const meta = [
    t("usedCount", { current: invite.currentUses, max: invite.maxUses }),
    t("createdOn", { date: new Date(invite.createdAt).toLocaleDateString() }),
    ...(expired ? [t("expired")] : []),
  ].join(" · ");
  const users = invite.usages.map((usage) => usage.username).join(", ");

  return (
    <View style={[st.invite, !last && st.inviteBordered, !active && st.inactive]}>
      <View style={st.inviteText}>
        <Text style={st.key} selectable numberOfLines={1}>{invite.key}</Text>
        <Text style={st.meta}>{meta}</Text>
        {users ? <Text style={st.meta} numberOfLines={2}>{users}</Text> : null}
      </View>
      {active && (
        <Pressable
          onPress={(e) => onShare(invite.key, Number(e.nativeEvent.target))}
          accessibilityRole="button"
          accessibilityLabel={t("shareLink")}
          style={({ pressed }) => [st.iconBtn, pressed && st.pressed]}
        >
          <Feather name="share" size={19} color={theme.colors.brand.violet} />
        </Pressable>
      )}
    </View>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const step = (delta: number) => onChange(Math.min(MAX_USES_LIMIT, Math.max(1, value + delta)));
  return (
    <View style={st.stepper} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ now: value }}>
      <Pressable onPress={() => step(-1)} disabled={value <= 1} style={({ pressed }) => [st.iconBtn, value <= 1 && st.inactive, pressed && st.pressed]} accessibilityLabel="−">
        <Feather name="minus" size={18} color={theme.colors.text.secondary} />
      </Pressable>
      <Text style={st.stepValue}>{value}</Text>
      <Pressable onPress={() => step(1)} disabled={value >= MAX_USES_LIMIT} style={({ pressed }) => [st.iconBtn, pressed && st.pressed]} accessibilityLabel="+">
        <Feather name="plus" size={18} color={theme.colors.text.secondary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  invite: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, minHeight: 60, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  inviteBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
  inviteText: { flex: 1, gap: 2 },
  inactive: { opacity: 0.45 },
  key: { ...typography.body, fontFamily: "monospace", color: t.colors.brand.light },
  meta: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center" as const, justifyContent: "center" as const },
  pressed: { backgroundColor: t.colors.fill.subtle },
  stepper: { flexDirection: "row" as const, alignItems: "center" as const },
  stepValue: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, minWidth: 28, textAlign: "center" as const },
});
