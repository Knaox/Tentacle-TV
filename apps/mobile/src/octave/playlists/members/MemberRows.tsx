/**
 * Octave mobile — les rangées de la feuille des personnes : une personne (photo, nom, légende, une action), et le
 * CHOIX d'un droit au doigt — la rangée s'ouvre sur les trois droits (boutons radio de 48 pt), jamais une alerte
 * (Android n'y montre que trois boutons). Le propriétaire y retire aussi la personne.
 */

import { memo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, UserMinus } from "lucide-react-native";
import { MUSIC_PLAYLIST_MEMBER_RIGHTS, type MusicPlaylistMemberRight, type MusicPlaylistPerson } from "@tentacle-tv/shared/music";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { typography, useTheme } from "@/theme";

export const PersonRow = memo(function PersonRow({ person, caption, right }: { person: MusicPlaylistPerson; caption?: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <UserAvatar userId={person.userId} name={person.name} hasAvatar={person.imageTag !== null} imageTag={person.imageTag || null} size={40} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{person.name}</Text>
        {caption ? <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
});

interface RightChoicesProps {
  value: MusicPlaylistMemberRight;
  onChange: (right: MusicPlaylistMemberRight) => void;
  disabled?: boolean;
}

/** Les trois droits, en boutons radio. */
export function RightChoices({ value, onChange, disabled }: RightChoicesProps) {
  const { t } = useTranslation("musicPlaylistMembers");
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      {MUSIC_PLAYLIST_MEMBER_RIGHTS.map((right) => {
        const selected = right === value;
        return (
          <Pressable
            key={right}
            disabled={disabled}
            onPress={() => onChange(right)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent", opacity: disabled ? 0.5 : 1 }]}
          >
            <Text style={[typography.body, styles.text, { color: theme.colors.text.primary }]}>{t(`rights.${right}`)}</Text>
            {selected ? <Check size={18} color={theme.colors.brand.accentLight} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface MemberRowProps {
  person: MusicPlaylistPerson;
  right: MusicPlaylistMemberRight;
  disabled: boolean;
  onRight: (right: MusicPlaylistMemberRight) => void;
  onRemove: () => void;
}

/** Un membre, côté propriétaire : un appui ouvre ses droits et « Retirer ». */
export const MemberRow = memo(function MemberRow({ person, right, disabled, onRight, onRemove }: MemberRowProps) {
  const { t } = useTranslation("musicPlaylistMembers");
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.name}, ${t(`rights.${right}`)}`}
        accessibilityHint={t("rightOf", { name: person.name })}
      >
        <PersonRow person={person} caption={t(`rights.${right}`)} right={<ChevronDown size={18} color={theme.colors.text.tertiary} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />} />
      </Pressable>
      {open ? (
        <View style={styles.expanded}>
          <RightChoices value={right} onChange={onRight} disabled={disabled} />
          <Pressable
            disabled={disabled}
            onPress={onRemove}
            accessibilityRole="button"
            style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent", opacity: disabled ? 0.5 : 1 }]}
          >
            <UserMinus size={18} color={theme.colors.status.error} />
            <Text style={[typography.body, styles.text, { color: theme.colors.status.error }]}>{t("removeMember", { name: person.name })}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, minWidth: 0 },
  choice: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 12 },
  expanded: { paddingLeft: 40, paddingBottom: 6 },
});
