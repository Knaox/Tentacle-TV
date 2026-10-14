import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { GalleryLayout } from "./galleryLayout";

interface UploadTileProps {
  disabled: boolean;
  layout: GalleryLayout;
  onPress: () => void;
}

/**
 * « Importer une photo » : la photo personnelle reste à portée, en tête de la
 * galerie, au gabarit d'un personnage — un rond en pointillés. Elle ouvre la
 * photothèque, recadrage carré, comme le faisait la photo du profil.
 */
export const UploadTile = memo(function UploadTile({ disabled, layout, onPress }: UploadTileProps) {
  const { t } = useTranslation("avatars");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  // La place de l'anneau d'une tuile de personnage : les rangées restent alignées.
  const frame = layout.art + 10;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${t("upload")}, ${t("mobile.uploadHint")}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [st.tile, { width: layout.tileWidth }, pressed && st.pressed]}
    >
      <View style={{ width: frame, height: frame, alignItems: "center", justifyContent: "center" }}>
        <View style={[st.circle, { width: layout.art, height: layout.art, borderRadius: layout.art / 2 }]}>
          <Feather name="image" size={26} color={theme.colors.text.secondary} />
        </View>
      </View>
      <Text style={st.label} numberOfLines={2}>
        {t("upload")}
      </Text>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tile: { alignItems: "center", paddingTop: 4, paddingBottom: 6, gap: 6, borderRadius: 16 },
    pressed: { opacity: 0.7 },
    circle: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.fill.subtle,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { ...typography.caption, color: t.colors.text.secondary, textAlign: "center", lineHeight: 16 },
  });
