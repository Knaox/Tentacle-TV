import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { FamilyAvatar } from "@/family/FamilyAvatar";
import { useFamilyText } from "@/family/useFamilyText";
import { useTheme, useThemedStyles } from "@/theme";
import { makeFamilyRowStyles } from "./familyRowStyles";

interface FamilyProfileRowProps {
  profile: FamilyProfileDto;
  last: boolean;
  /** Les gestes du propriétaire (session personnelle). */
  canManage: boolean;
  onRemove: (profile: FamilyProfileDto) => void;
  onManageGuest: (profile: FamilyProfileDto) => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;

/**
 * Un profil de MA famille : avatar à sa couleur, nom, rôle, ancienneté, code
 * PIN. Les gestes : retirer un membre (son compte n'est jamais touché) ;
 * « Gérer » un invité — son code PIN, sa suppression.
 */
export const FamilyProfileRow = memo(function FamilyProfileRow({ profile, last, canManage, onRemove, onManageGuest }: FamilyProfileRowProps) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeFamilyRowStyles);
  const { formatDate } = useFamilyText();
  const guest = profile.kind === "guest";

  return (
    <View style={[st.row, !last && st.bordered]}>
      <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={40} />
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>
          {profile.name}
          {profile.kind === "owner" ? <Text style={st.metaText}>{`  · ${t("familyWeb:owned.you")}`}</Text> : null}
        </Text>
        <View style={st.meta}>
          <View style={[st.chip, guest && st.chipGuest]}>
            <Text style={[st.chipText, guest && st.chipGuestText]}>{t(KIND_KEY[profile.kind])}</Text>
          </View>
          {profile.since ? <Text style={st.metaText}>{t("familyWeb:owned.since", { date: formatDate(profile.since) })}</Text> : null}
          {profile.hasPin ? (
            <View style={st.pinMeta}>
              <Feather name="lock" size={11} color={theme.colors.text.tertiary} />
              <Text style={st.metaText}>{t("familyWeb:owned.pinOn")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {canManage && profile.kind === "member" ? (
        <Pressable
          onPress={() => onRemove(profile)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("familyWeb:owned.remove")} — ${profile.name}`}
          style={({ pressed }) => [st.action, pressed && st.dim]}
        >
          <Text style={st.dangerText}>{t("familyWeb:owned.remove")}</Text>
        </Pressable>
      ) : null}
      {canManage && guest ? (
        <Pressable
          onPress={() => onManageGuest(profile)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("familyMobile:manage")} — ${profile.name}`}
          style={({ pressed }) => [st.action, pressed && st.dim]}
        >
          <Text style={st.actionText}>{t("familyMobile:manage")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
