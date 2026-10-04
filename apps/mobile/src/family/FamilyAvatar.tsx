import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { profileColorStops, type FamilyProfileColor } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { FONT_FAMILY } from "@/theme";

interface FamilyAvatarProps {
  userId: string;
  name: string;
  color: FamilyProfileColor;
  /** La photo Jellyfin du compte ; null : l'initiale sur la couleur du profil
   *  (toujours le cas d'un invité, qui n'a pas de photo). */
  imageTag: string | null;
  size: number;
}

/** L'avatar d'un profil de la Famille : sa photo s'il en a une, sinon son
 *  initiale sur SA couleur — celle que la TV et le web montrent aussi
 *  (`FAMILY_PROFILE_COLOR_STOPS`, shared). */
export const FamilyAvatar = memo(function FamilyAvatar({ userId, name, color, imageTag, size }: FamilyAvatarProps) {
  if (imageTag) return <UserAvatar userId={userId} name={name} hasAvatar imageTag={imageTag} size={size} />;
  return <ProfileInitial name={name} color={color} size={size} />;
});

/** L'initiale blanche sur le dégradé du profil (aperçu d'un invité compris). */
export const ProfileInitial = memo(function ProfileInitial({ name, color, size }: { name: string; color: FamilyProfileColor; size: number }) {
  const [from, to] = profileColorStops(color);
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[st.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessible={false}
    >
      <Text style={[st.initial, { fontSize: Math.max(11, Math.round(size * 0.42)) }]}>{initial}</Text>
    </LinearGradient>
  );
});

const st = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  // Blanc sur les teintes profondes du contrat : 4,5:1 au moins (shared).
  initial: { color: "#ffffff", fontFamily: FONT_FAMILY.bold },
});
