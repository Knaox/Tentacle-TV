import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { AVATAR_CHARACTERS, findAvatar } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { showToast } from "@/notices/toastStore";
import { SHEET_MAX_WIDTH, spacing, typography, useResponsive, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { characterPhoto, pickLibraryPhoto } from "../photoSources";
import { useProfilePhotoUpload, type PhotoUploadResult } from "../useProfilePhotoUpload";
import { AvatarGrid } from "./AvatarGrid";
import { AvatarStoryFooter, type CurrentPhoto } from "./AvatarStoryFooter";
import { galleryLayout, GALLERY_GUTTER } from "./galleryLayout";

/** `change` : ouverte depuis la photo du profil ; `invite` : l'invitation unique du lancement. */
export type AvatarGalleryMode = "change" | "invite";

interface AvatarGallerySheetProps {
  visible: boolean;
  mode: AvatarGalleryMode;
  current: CurrentPhoto;
  onClose: () => void;
}

/**
 * La galerie des photos de profil, en feuille : « Importer une photo » en
 * tête, puis la troupe, collection par collection. Pas de survol au doigt :
 * toucher un personnage le DÉSIGNE et le présente au pied ; « Choisir … » —
 * ou un second toucher sur le désigné — l'envoie comme photo Jellyfin du
 * compte, par le même chemin qu'une photo importée. Réussite dite par un
 * message bref (la feuille se ferme), échec par l'alerte d'aujourd'hui : la
 * feuille reste ouverte pour réessayer.
 */
export function AvatarGallerySheet({ visible, mode, current, onClose }: AvatarGallerySheetProps) {
  const { t } = useTranslation("avatars");
  const { t: tProfile } = useTranslation("profile");
  const st = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const { isTablet } = useResponsive();
  const layout = useMemo(() => galleryLayout(Math.min(width, SHEET_MAX_WIDTH), isTablet), [width, isTablet]);
  const { upload, uploading } = useProfilePhotoUpload();
  const [designatedId, setDesignatedId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setDesignatedId(null);
  }, [visible]);

  const finish = useCallback((result: PhotoUploadResult) => {
    if (result === "sent") {
      haptic("success");
      showToast({ title: tProfile("avatarUpdated"), tone: "success" });
      onClose();
    } else if (result === "failed") {
      Alert.alert(tProfile("photoErrorTitle"), tProfile("photoErrorMessage"));
    }
  }, [tProfile, onClose]);

  const apply = useCallback((id: string) => {
    void upload(() => characterPhoto(id)).then(finish);
  }, [upload, finish]);

  // Un toucher sur le personnage déjà désigné : on le prend.
  const onTile = useCallback((id: string) => {
    if (id === designatedId) {
      apply(id);
      return;
    }
    haptic("select");
    setDesignatedId(id);
    AccessibilityInfo.announceForAccessibility(`${t(`characters.${id}.name`)}. ${t(`characters.${id}.story`)}`);
  }, [designatedId, apply, t]);

  const onUpload = useCallback(() => {
    void (async () => {
      const picked = await pickLibraryPhoto();
      if (picked === "denied") {
        Alert.alert(tProfile("photoErrorTitle"), tProfile("photoPermissionMessage"));
        return;
      }
      if (picked !== null) finish(await upload(async () => picked));
    })();
  }, [upload, finish, tProfile]);

  const onChoose = useCallback(() => {
    if (designatedId) apply(designatedId);
  }, [designatedId, apply]);

  const invite = mode === "invite";
  const character = designatedId ? findAvatar(designatedId) ?? null : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.88, 0.95]}>
      <View style={styles.frame}>
        <View style={st.header}>
          {invite ? (
            <View style={st.eyebrow}>
              <Text style={st.eyebrowText}>{t("invite.eyebrow")}</Text>
            </View>
          ) : null}
          <Text style={st.title} accessibilityRole="header">
            {invite ? t("invite.title") : t("title")}
          </Text>
          <Text style={st.subtitle}>
            {invite ? t("invite.subtitle", { count: AVATAR_CHARACTERS.length }) : t("subtitle")}
          </Text>
        </View>
        <View style={styles.frame}>
          <AvatarGrid layout={layout} designatedId={designatedId} disabled={uploading} onTile={onTile} onUpload={onUpload} />
        </View>
        <AvatarStoryFooter
          character={character}
          current={current}
          invite={invite}
          busy={uploading}
          onCancel={onClose}
          onChoose={onChoose}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: { paddingHorizontal: GALLERY_GUTTER, paddingBottom: spacing.md, gap: spacing.xs },
    eyebrow: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.colors.brand.ghost,
      marginBottom: 2,
    },
    eyebrowText: {
      ...typography.badge,
      textTransform: "uppercase",
      color: t.isDark ? t.colors.brand.light : t.colors.brand.violet,
    },
    title: { ...typography.subtitle, fontSize: 20, color: t.colors.text.primary },
    subtitle: { ...typography.caption, lineHeight: 18, color: t.colors.text.secondary },
  });
