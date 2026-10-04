import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { guestCanRequest, type FamilyProfileDto } from "@tentacle-tv/shared";
import { FamilyAvatar } from "@/family/FamilyAvatar";
import { useFamilyText } from "@/family/useFamilyText";
import { useTheme, useThemedStyles } from "@/theme";
import { makeFamilyRowStyles } from "./familyRowStyles";

interface FamilyProfileRowProps {
  profile: FamilyProfileDto;
  last: boolean;
  /** Ce profil est celui de ce compte (« · Vous »). */
  you: boolean;
  /** Un invité que ce compte (un membre) a créé : « Votre invité ». */
  yours?: boolean;
  /** Le profil se gère d'ici : la ligne entière ouvre son panneau (chevron). */
  onOpen?: (profile: FamilyProfileDto) => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;

/**
 * Un profil de la famille : avatar à sa couleur, nom, rôle, ancienneté, code
 * PIN. Quand on peut le gérer, la ligne entière ouvre son panneau
 * (`FamilyProfileSheet`) — une cible pleine largeur plutôt qu'un petit mot.
 */
export const FamilyProfileRow = memo(function FamilyProfileRow({ profile, last, you, yours, onOpen }: FamilyProfileRowProps) {
  const { t } = useTranslation(["familyWeb", "family", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeFamilyRowStyles);
  const { formatDate } = useFamilyText();
  const guest = profile.kind === "guest";
  const kind = t(KIND_KEY[profile.kind]);

  const content = (
    <View style={[st.row, !last && st.bordered]}>
      <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={40} />
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>
          {profile.name}
          {you ? <Text style={st.metaText}>{`  · ${t("familyWeb:owned.you")}`}</Text> : null}
        </Text>
        <View style={st.meta}>
          <View style={[st.chip, guest && st.chipGuest]}>
            <Text style={[st.chipText, guest && st.chipGuestText]}>{kind}</Text>
          </View>
          {yours ? <Text style={st.metaText}>{t("familyWeb:shared.yourGuest")}</Text> : null}
          {profile.since ? <Text style={st.metaText}>{t("familyWeb:owned.since", { date: formatDate(profile.since) })}</Text> : null}
          {guest && guestCanRequest(profile) ? (
            <View style={st.pinMeta}>
              <Feather name="film" size={11} color={theme.colors.text.tertiary} />
              <Text style={st.metaText}>{t("family:rights.requestTitles")}</Text>
            </View>
          ) : null}
          {profile.hasPin ? (
            <View style={st.pinMeta}>
              <Feather name="lock" size={11} color={theme.colors.text.tertiary} />
              <Text style={st.metaText}>{t("familyWeb:owned.pinOn")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {onOpen ? <Feather name="chevron-right" size={18} color={theme.colors.text.quaternary} /> : null}
    </View>
  );

  if (!onOpen) return content;
  return (
    <Pressable
      onPress={() => onOpen(profile)}
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${kind}`}
      accessibilityHint={t("familyMobile:openProfileHint")}
      style={({ pressed }) => (pressed ? st.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
});
