import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { PickerProfileDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { FamilyAvatar } from "../../FamilyAvatar";

export const TILE_AVATAR = 88;
export const TILE_WIDTH = 112;

interface ProfileTileProps {
  profile: PickerProfileDto;
  /** Le cadenas : la choisir demandera VRAIMENT le code (`pickerShowsPinLock`). */
  locked: boolean;
  /** Le profil en cours sur l'appareil (« Changer de profil »). */
  current: boolean;
  opening: boolean;
  disabled: boolean;
  onPress: (profileId: string) => void;
}

/** Une tuile de « Qui regarde ? » : l'avatar du profil, son nom, son rôle, le cadenas s'il a un code. */
export const ProfileTile = memo(function ProfileTile({ profile, locked, current, opening, disabled, onPress }: ProfileTileProps) {
  const { t } = useTranslation(["profilePicker", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const label = current
    ? t("profilePicker:tileLabelCurrent", { name: profile.name })
    : t(locked ? "profilePicker:tileLabelPin" : "profilePicker:tileLabel", { name: profile.name });
  const role = profile.kind === "guest" ? t("familyMobile:launch.guest") : profile.kind === "owner" ? t("familyMobile:launch.owner") : t("familyMobile:launch.member");

  return (
    <Pressable
      onPress={() => onPress(profile.userId)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: opening, selected: current }}
      style={({ pressed }) => [st.tile, pressed && st.pressed, disabled && !opening && st.dim]}
    >
      <View style={[st.ring, current && { borderColor: theme.colors.brand.light }]}>
        <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={TILE_AVATAR} />
        {opening ? (
          <View style={st.veil}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}
        {locked ? (
          <View style={st.lock}>
            <Feather name="lock" size={13} color={theme.colors.text.primary} />
          </View>
        ) : null}
      </View>
      <Text style={st.name} numberOfLines={1}>{profile.name}</Text>
      <Text style={st.role} numberOfLines={1}>{current ? t("profilePicker:current") : role}</Text>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tile: { width: TILE_WIDTH, alignItems: "center", paddingVertical: spacing.sm, borderRadius: 20 },
    pressed: { backgroundColor: t.colors.fill.subtle },
    dim: { opacity: 0.5 },
    ring: {
      width: TILE_AVATAR + 8,
      height: TILE_AVATAR + 8,
      borderRadius: (TILE_AVATAR + 8) / 2,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    veil: {
      ...StyleSheet.absoluteFillObject,
      margin: 4,
      borderRadius: TILE_AVATAR / 2,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    lock: {
      position: "absolute",
      right: 2,
      bottom: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { ...typography.bodyBold, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: spacing.sm, maxWidth: TILE_WIDTH - 8 },
    role: { ...typography.small, color: t.colors.text.tertiary, marginTop: 2, maxWidth: TILE_WIDTH - 8 },
  });
