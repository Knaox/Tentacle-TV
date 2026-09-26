import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, SHADOW_RN, useTheme, useThemedStyles, type AppTheme } from "../../theme";
import { profilePhotoUrl, refreshStoredUser, type StoredUser } from "@/auth/storedUser";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { cachedAvatarUri, syncAvatarCache } from "@/offline/avatarCache";

interface Props {
  /** Le profil stocké, réactif (`useStoredUser`). */
  user: StoredUser | null;
  initial: string;
}

/**
 * Avatar du profil — affiche la photo de profil Jellyfin (PrimaryImageTag)
 * et permet de la changer depuis l'appareil : photothèque → recadrage carré →
 * upload base64 vers `POST /Users/{id}/Images/Primary` (API Jellyfin), puis
 * relecture du profil, dont la nouvelle étiquette change l'URL (cache bust).
 * L'étiquette n'est plus figée au montage : toute relecture du profil
 * remplace la photo sous les yeux. Repli : initiale sur dégradé violet
 * (comportement historique).
 */
export function ProfileAvatar({ user, initial }: Props) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const [busy, setBusy] = useState(false);
  // L'URL en échec plutôt qu'un drapeau : une nouvelle étiquette donne une
  // nouvelle URL, qui retente d'elle-même.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Envoi réussi mais relecture sans nouvelle étiquette (réseau coupé entre
  // les deux) : une valeur locale force la nouvelle image tant que
  // l'étiquette stockée reste l'ancienne.
  const [pendingPhoto, setPendingPhoto] = useState<{ staleTag: string | null; nonce: string } | null>(null);
  const offline = useOfflineMode();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const jfBase = serverUrl ? `${serverUrl}/api/jellyfin` : "";
  const userId = user?.Id ?? null;
  const storedTag = user?.PrimaryImageTag ?? null;
  const tag = pendingPhoto !== null && pendingPhoto.staleTag === storedTag ? pendingPhoto.nonce : storedTag;
  const photoUrl = userId ? profilePhotoUrl(serverUrl, userId, tag) : null;
  // Hors ligne — ou dès que Jellyfin ne répond pas — la copie locale prend le
  // relais : perdre son visage au premier tunnel donne l'impression d'être
  // déconnecté. En ligne sans étiquette, c'est l'initiale : la photo a été
  // retirée, et la copie locale le sera à la prochaine synchronisation.
  const fallback = offline || (photoUrl !== null && failedUrl === photoUrl);
  const cachedUri = useMemo(() => (userId && fallback ? cachedAvatarUri(userId) : null), [userId, fallback]);
  const shownUri = fallback ? cachedUri : photoUrl;

  const pickAndUpload = async () => {
    if (!user || !jfBase || busy || offline) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("photoErrorTitle"), t("photoPermissionMessage"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.base64) return;

    setBusy(true);
    try {
      // L'API Jellyfin attend le corps ENCODÉ base64 avec le Content-Type image.
      const upload = await fetch(`${jfBase}/Users/${user.Id}/Images/Primary`, {
        method: "POST",
        headers: {
          Authorization: client.getAuthHeader(),
          "Content-Type": asset.mimeType ?? "image/jpeg",
        },
        body: asset.base64,
      });
      if (!upload.ok) throw new Error(`${upload.status}`);

      // Le nouveau PrimaryImageTag (sert d'URL de cache bust), écrit dans le
      // profil stocké : cet écran et les suivants le reçoivent. Une relecture
      // en échec ne fait pas de l'envoi réussi une erreur.
      const photoChanged = await refreshStoredUser(storage, client);
      if (!photoChanged) setPendingPhoto({ staleTag: storedTag, nonce: `${Date.now()}` });
      const token = storage.getItem("tentacle_token");
      if (token) syncAvatarCache(user.Id, serverUrl, token, storage);
    } catch {
      Alert.alert(t("photoErrorTitle"), t("photoErrorMessage"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={pickAndUpload}
      disabled={busy || offline}
      accessibilityRole="button"
      accessibilityLabel={t("changePhoto")}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {shownUri ? (
        <Image
          source={{ uri: shownUri }}
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
          colors={[theme.colors.brand.dark, theme.colors.brand.violet, theme.colors.brand.light]}
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

      {busy && (
        <View style={st.busyOverlay}>
          <ActivityIndicator color={theme.colors.cta.brandFg} size="small" />
        </View>
      )}
    </Pressable>
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
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    backgroundColor: t.colors.overlay.scrimSoft,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
});
