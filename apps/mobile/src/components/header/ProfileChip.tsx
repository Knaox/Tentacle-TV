import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { profilePhotoUrl } from "@/auth/storedUser";
import { useCachedPhotoRepair } from "@/avatars/useCachedPhotoRepair";
import { useStoredUser } from "@/auth/useStoredUser";
import { profileColorStops } from "@tentacle-tv/shared";
import { useAccountFaceColor } from "@/family/profiles/useAccountFaceColor";
import { openProfileSwitcher } from "@/profileSwitch/profileSwitchEntry";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const PHOTO = 26;
/** Un prénom long se coupe : les actions de l'en-tête gardent leur place sur 375 pt. */
const NAME_MAX_WIDTH = 104;
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

/**
 * La puce du profil actif, à côté du logo : sa photo, son prénom, un chevron.
 * Le toucher ouvre « Changer de profil » — le nom EST le bouton, rien à
 * chercher. `compact` (pastille d'économie de données à côté) : la photo et
 * le chevron seuls.
 *
 * Le profil lu est celui de la session en cours (`tentacle_user`), personnel
 * ou de profil : la puce dit toujours sur quel profil on regarde.
 */
export const ProfileChip = memo(function ProfileChip({ compact }: { compact?: boolean }) {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  // Sans photo : la couleur du profil, la même que « Qui regarde ? » et la Famille.
  const faceColor = useAccountFaceColor();
  const [failed, setFailed] = useState<string | null>(null);

  const name = user?.Name ?? "";
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const photo = user ? profilePhotoUrl(serverUrl, user.Id, user.PrimaryImageTag) : null;
  const shown = photo !== null && photo !== failed ? photo : null;
  const repair = useCachedPhotoRepair(shown);

  return (
    <Pressable
      onPress={openProfileSwitcher}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t("profileChipLabel", { name })}
      style={({ pressed }) => [st.chip, compact && st.chipCompact, pressed && st.pressed]}
    >
      {shown ? (
        <Image key={repair.key} onLoad={repair.onLoad} source={{ uri: shown }} style={st.photo} contentFit="cover" onError={() => setFailed(shown)} />
      ) : (
        <LinearGradient
          colors={faceColor ? [...profileColorStops(faceColor)] : [theme.colors.brand.violet, theme.colors.brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.photo}
        >
          <Text style={st.initial}>{name.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
      )}
      {!compact && (
        <Text style={st.name} numberOfLines={1}>
          {name}
        </Text>
      )}
      <View style={st.chevron}>
        <Feather name="chevron-down" size={14} color={theme.colors.text.secondary} />
      </View>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 32,
      paddingLeft: 3,
      paddingRight: 8,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.fill.subtle,
    },
    chipCompact: { gap: 2, paddingRight: 5 },
    pressed: { opacity: 0.7 },
    photo: {
      width: PHOTO,
      height: PHOTO,
      borderRadius: PHOTO / 2,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    initial: { fontSize: 12, fontFamily: FONT_FAMILY.bold, color: "#ffffff" },
    name: { maxWidth: NAME_MAX_WIDTH, fontSize: 14, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    chevron: { marginTop: 1 },
  });
