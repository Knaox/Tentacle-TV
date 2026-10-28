import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, SHADOW_RN, useTheme, useThemedStyles, type AppTheme } from "../../theme";
import { profilePhotoUrl, type StoredUser } from "@/auth/storedUser";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { cachedAvatarUri } from "@/offline/avatarCache";
import { pendingPhotoSnapshot, photoTagFor, subscribePendingPhoto } from "@/avatars/pendingPhoto";
import { AvatarGallerySheet } from "@/avatars/gallery/AvatarGallerySheet";
import { useCachedPhotoRepair } from "@/avatars/useCachedPhotoRepair";
import { profileColorStops } from "@tentacle-tv/shared";
import { useAccountFaceColor } from "@/family/profiles/useAccountFaceColor";

interface Props {
  /** Le profil stocké, réactif (`useStoredUser`). */
  user: StoredUser | null;
  initial: string;
}

/**
 * Avatar du profil — affiche la photo de profil Jellyfin (PrimaryImageTag).
 * Le toucher ouvre la galerie des photos de profil (`avatars/gallery/`) :
 * « Importer une photo » (photothèque, recadrage carré) ou un personnage de la
 * troupe, envoyés par le même chemin (`useProfilePhotoUpload`), puis relecture
 * du profil, dont la nouvelle étiquette change l'URL (cache bust).
 * L'étiquette n'est plus figée au montage : toute relecture du profil
 * remplace la photo sous les yeux. Repli : initiale sur dégradé violet
 * (comportement historique).
 */
export function ProfileAvatar({ user, initial }: Props) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { storage } = useTentacleConfig();
  const [galleryOpen, setGalleryOpen] = useState(false);
  // L'URL en échec plutôt qu'un drapeau : une nouvelle étiquette donne une
  // nouvelle URL, qui retente d'elle-même.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Envoi réussi mais relecture sans nouvelle étiquette (réseau coupé entre
  // les deux) : une valeur locale force la nouvelle image tant que
  // l'étiquette stockée reste l'ancienne (`pendingPhoto`, d'où que parte l'envoi).
  useSyncExternalStore(subscribePendingPhoto, pendingPhotoSnapshot, pendingPhotoSnapshot);
  const offline = useOfflineMode();
  // Sans photo : la couleur du profil, la même que « Qui regarde ? » et la Famille.
  const faceColor = useAccountFaceColor();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const userId = user?.Id ?? null;
  const storedTag = user?.PrimaryImageTag ?? null;
  const tag = photoTagFor(userId, storedTag);
  const photoUrl = userId ? profilePhotoUrl(serverUrl, userId, tag) : null;
  // Hors ligne — ou dès que Jellyfin ne répond pas — la copie locale prend le
  // relais : perdre son visage au premier tunnel donne l'impression d'être
  // déconnecté. En ligne sans étiquette, c'est l'initiale : la photo a été
  // retirée, et la copie locale le sera à la prochaine synchronisation.
  const fallback = offline || (photoUrl !== null && failedUrl === photoUrl);
  const cachedUri = useMemo(() => (userId && fallback ? cachedAvatarUri(userId) : null), [userId, fallback]);
  const shownUri = fallback ? cachedUri : photoUrl;
  // Une photo gardée tronquée par le cache disque se répare au chargement (`useCachedPhotoRepair`).
  const repair = useCachedPhotoRepair(fallback ? null : photoUrl);

  const current = useMemo(() => ({ uri: shownUri, initial }), [shownUri, initial]);
  const closeGallery = useCallback(() => setGalleryOpen(false), []);

  return (
    <>
      <Pressable
        onPress={() => setGalleryOpen(true)}
        disabled={!user || !serverUrl || offline}
        accessibilityRole="button"
        accessibilityLabel={t("changePhoto")}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        {shownUri ? (
          <Image
            key={repair.key}
            source={{ uri: shownUri }}
            onLoad={repair.onLoad}
            style={st.photo}
            contentFit="cover"
            transition={200}
            // La copie locale se remplace sous le même nom : expo-image ne doit
            // pas en garder une version (cf. OfflineLocalImage).
            cachePolicy={fallback ? "none" : "disk"}
            onError={() => {
              if (!fallback) setFailedUrl(photoUrl);
            }}
          />
        ) : (
          <LinearGradient
            colors={faceColor ? [...profileColorStops(faceColor)] : [theme.colors.brand.dark, theme.colors.brand.violet, theme.colors.brand.light]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={st.avatar}
          >
            <Text style={st.avatarTxt}>{initial}</Text>
          </LinearGradient>
        )}
        {/* Affordance : petit badge caméra (la photo se change au tap) */}
        <View style={st.cameraBadge}>
          <Feather name="camera" size={11} color={theme.colors.cta.brandFg} />
        </View>
      </Pressable>
      <AvatarGallerySheet visible={galleryOpen} mode="change" current={current} onClose={closeGallery} />
    </>
  );
}

const SIZE = 76;

const makeStyles = (t: AppTheme) => StyleSheet.create({
  avatar: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    alignItems: "center" as const, justifyContent: "center" as const,
    ...SHADOW_RN.elev3,
  },
  photo: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    backgroundColor: t.colors.fill.subtle,
  },
  avatarTxt: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: t.colors.cta.brandFg, letterSpacing: -0.5 },
  cameraBadge: {
    position: "absolute" as const, right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: t.colors.brand.violet,
    borderWidth: 2, borderColor: t.colors.surface.s0,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
});
