import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { FamilyAvatar } from "@/family/FamilyAvatar";
import { useFamilyText } from "@/family/useFamilyText";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { FamilySheet } from "./FamilySheet";

interface FamilyProfileSheetProps {
  profile: FamilyProfileDto;
  /** Les réglages du profil (droits), au-dessus des gestes. */
  children?: ReactNode;
  /** Invité : son code PIN, posé par qui le gère. */
  onPin?: () => void;
  /** Le geste qui retire : « Retirer » un membre, « Supprimer » un invité (confirmé à part). */
  onRemove?: () => void;
  onClose: () => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;

/**
 * Le panneau d'UN profil de la famille, ouvert d'un appui sur sa ligne : qui
 * il est, ses réglages, puis ses gestes — le code PIN d'un invité, et le
 * geste qui le retire, séparé en bas et confirmé. Il remplace un menu
 * d'alerte : les droits (interrupteurs) y trouvent leur place.
 */
export function FamilyProfileSheet({ profile, children, onPin, onRemove, onClose }: FamilyProfileSheetProps) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const st = useThemedStyles(makeStyles);
  const { formatDate } = useFamilyText();
  const guest = profile.kind === "guest";

  return (
    <FamilySheet title={profile.name} closeLabel={t("familyWeb:close")} onClose={onClose}>
      <View style={st.identity} accessible accessibilityRole="header">
        <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={72} />
        <Text style={st.name} numberOfLines={2}>{profile.name}</Text>
        <Text style={st.meta}>
          {[t(KIND_KEY[profile.kind]), profile.since ? t("familyWeb:owned.since", { date: formatDate(profile.since) }) : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {guest && profile.createdByName ? (
          <Text style={st.meta}>{t("familyMobile:addedBy", { name: profile.createdByName })}</Text>
        ) : null}
      </View>

      {children}

      {guest && onPin ? (
        <SettingsSection>
          <SettingsRow
            icon={profile.hasPin ? "lock" : "unlock"}
            label={t("familyWeb:owned.setPin")}
            value={profile.hasPin ? t("familyWeb:myPin.on") : t("familyWeb:myPin.off")}
            chevron
            last
            onPress={onPin}
          />
        </SettingsSection>
      ) : null}

      {onRemove ? (
        <SettingsSection>
          <SettingsRow
            icon={guest ? "trash-2" : "user-minus"}
            label={guest ? t("familyWeb:confirm.deleteGuestAction") : t("familyWeb:owned.remove")}
            destructive
            last
            onPress={onRemove}
          />
        </SettingsSection>
      ) : null}
    </FamilySheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    identity: { alignItems: "center", marginBottom: spacing.xl },
    name: { ...typography.subtitle, color: t.colors.text.primary, marginTop: spacing.md, textAlign: "center" },
    meta: { ...typography.small, color: t.colors.text.tertiary, marginTop: spacing.xs, textAlign: "center" },
  });
