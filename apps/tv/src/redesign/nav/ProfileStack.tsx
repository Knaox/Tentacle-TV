import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { ProfileAvatar } from "../screens/profiles/ProfileAvatar";
import { Icon } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * Le pictogramme de « Changer de profil » : un EMPILEMENT des profils de la
 * famille, comme chez Netflix — trois ronds qui se chevauchent au plus ; au-
 * delà, deux et un « +N ». Jamais la photo d'un seul : c'est la famille, pas
 * le compte. Sans profils lus (encore), la silhouette.
 */

export interface StackProfile {
  id: string;
  name: string;
  color: FamilyProfileColor;
  avatarUri?: string;
}

/** Le rond, son liseré, et le pas d'un rond au suivant : trois tiennent dans la case d'un pictogramme (64), avec du jour autour. */
const SIZE = 26;
const RING = 2;
const OUTER = SIZE + RING * 2;
const STEP = 15;
const MAX_SHOWN = 3;

/**
 * `ring` : la couleur du fond sous l'entrée — le liseré qui sépare les ronds
 * s'y fond (le verre au repos, la pilule blanche au focus).
 */
export const ProfileStack = memo(function ProfileStack({ profiles, color, ring }: { profiles: readonly StackProfile[]; color: string; ring: string }) {
  if (profiles.length === 0) return <Icon name="user" size={28} color={color} />;
  const overflow = profiles.length > MAX_SHOWN ? profiles.length - (MAX_SHOWN - 1) : 0;
  const shown = overflow ? profiles.slice(0, MAX_SHOWN - 1) : profiles;
  const count = shown.length + (overflow ? 1 : 0);
  return (
    <View style={{ width: OUTER + STEP * (count - 1), height: OUTER }}>
      {shown.map((profile, index) => (
        // Chaque rond passe devant le précédent : le dernier — le « +N » — se lit entier.
        <View key={profile.id} style={[styles.slot, { left: index * STEP, zIndex: index, backgroundColor: ring }]}>
          <ProfileAvatar name={profile.name} color={profile.color} uri={profile.avatarUri} size={SIZE} />
        </View>
      ))}
      {overflow ? (
        <View style={[styles.slot, styles.more, { left: shown.length * STEP, zIndex: count, borderColor: ring }]}>
          <Text style={styles.moreText} numberOfLines={1}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Un liseré à la couleur du fond sépare les ronds qui se chevauchent.
  slot: { position: "absolute", top: 0, width: OUTER, height: OUTER, borderRadius: OUTER / 2, padding: RING },
  more: { padding: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, borderWidth: RING },
  moreText: { ...fonts.bold, fontSize: 12, color: white(0.92) },
});
