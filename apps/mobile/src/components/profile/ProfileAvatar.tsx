import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, SHADOW_RN, useTheme, useThemedStyles, type AppTheme } from "../../theme";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { cachedAvatarUri, syncAvatarCache } from "@/offline/avatarCache";

interface JellyfinUser {
  Id: string;
  Name?: string;
  PrimaryImageTag?: string | null;
}

interface Props {
  user: JellyfinUser | null;
  initial: string;
}

/**
 * Avatar du profil — affiche la photo de profil Jellyfin (PrimaryImageTag)
 * et permet de la changer depuis l'appareil : photothèque → recadrage carré →
 * upload base64 vers `POST /Users/{id}/Images/Primary` (API Jellyfin), puis
 * re-lecture du user pour rafraîchir le tag (cache bust). Repli : initiale
 * sur dégradé violet (comportement historique).
 */
export function ProfileAvatar({ user, initial }: Props) {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const [tag, setTag] = useState<string | null>(user?.PrimaryImageTag ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const offline = useOfflineMode();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const jfBase = serverUrl ? `${serverUrl}/api/jellyfin` : "";
  const photoUrl = user && tag && jfBase
    ? `${jfBase}/Users/${user.Id}/Images/Primary?tag=${encodeURIComponent(tag)}&quality=90&maxWidth=200`
    : null;
  // Hors ligne — ou dès que Jellyfin ne répond pas — la copie locale prend le
  // relais : perdre son visage au premier tunnel donne l'impression d'être déconnecté.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tag` : re-résolution après un envoi
  const cachedUri = useMemo(() => (user ? cachedAvatarUri(user.Id) : null), [user, tag]);
  const shownUri = offline || failed ? cachedUri : (photoUrl ?? cachedUri);

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

      // Récupère le nouveau PrimaryImageTag (sert d'URL de cache bust) et
      // garde le user du storage à jour pour les prochains écrans.
      const fresh = await client.fetch<JellyfinUser>(`/Users/${user.Id}`);
      storage.setItem("tentacle_user", JSON.stringify(fresh));
      setTag(fresh.PrimaryImageTag ?? `${Date.now()}`);
      setFailed(false);
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
        <Image source={{ uri: shownUri }} style={st.photo} contentFit="cover" transition={200} onError={() => setFailed(true)} />
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
