import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { ProfileAvatar } from "../screens/profiles/ProfileAvatar";
import { Icon } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * Le pictogramme de « Changer de profil » : la photo du profil CONNECTÉ, et
 * une pastille « +N » pour les autres profils de cette TV (tv-core
 * `railSwitcherSummary`) — qui regarde, et qu'il y en a d'autres. Seul sur
 * la TV : la photo, sans pastille. Profil connecté pas encore lu : la
 * silhouette, et la pastille s'il y a des profils.
 *
 * La pastille se lit sur les deux fonds de l'entrée : claire sur le verre au
 * repos, sombre sur la pilule blanche du focus — et cerclée de la couleur du
 * fond (`ring`), qui la détache de la photo.
 */

export interface StackProfile {
  id: string;
  name: string;
  color: FamilyProfileColor;
  avatarUri?: string;
}

/** La photo, dans la case d'un pictogramme (64), avec la place de la pastille en bas à droite. */
const SIZE = 40;
const BADGE = 22;
const RING = 2;

export const ProfileSwitcherGlyph = memo(function ProfileSwitcherGlyph({ current, badge, color, ring, focused }: {
  current: StackProfile | null;
  badge: string | null;
  /** La couleur du texte de l'entrée (la silhouette). */
  color: string;
  /** La couleur du fond sous l'entrée : le liseré de la pastille. */
  ring: string;
  /** L'entrée porte le focus (pilule blanche) : la pastille passe en sombre. */
  focused: boolean;
}) {
  return (
    <View style={styles.box}>
      {current ? (
        <ProfileAvatar name={current.name} color={current.color} uri={current.avatarUri} size={SIZE} />
      ) : (
        <Icon name="user" size={28} color={color} />
      )}
      {badge ? (
        <View style={[styles.badge, { borderColor: ring }, focused ? styles.badgeOnFocus : styles.badgeAtRest]}>
          <Text style={[styles.badgeText, { color: focused ? white(0.96) : colors.ctaFg }]} numberOfLines={1}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  // Débordant en bas à droite de la photo : elle reste entière, le visage dégagé.
  badge: {
    position: "absolute",
    right: -10,
    bottom: -6,
    minWidth: BADGE + RING * 2,
    height: BADGE + RING * 2,
    borderRadius: BADGE / 2 + RING,
    borderWidth: RING,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeAtRest: { backgroundColor: white(0.94) },
  badgeOnFocus: { backgroundColor: colors.ctaFg },
  badgeText: { ...fonts.bold, fontSize: 14, lineHeight: 17 },
});
