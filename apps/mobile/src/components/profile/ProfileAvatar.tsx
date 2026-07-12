import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { BRAND, FONT_FAMILY, SHADOW_RN } from "../../theme";

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
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const [tag, setTag] = useState<string | null>(user?.PrimaryImageTag ?? null);
  const [busy, setBusy] = useState(false);

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const jfBase = serverUrl ? `${serverUrl}/api/jellyfin` : "";
  const photoUrl = user && tag && jfBase
    ? `${jfBase}/Users/${user.Id}/Images/Primary?tag=${encodeURIComponent(tag)}&quality=90&maxWidth=200`
    : null;

  const pickAndUpload = async () => {
    if (!user || !jfBase || busy) return;
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
    } catch {
      Alert.alert(t("photoErrorTitle"), t("photoErrorMessage"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={pickAndUpload}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t("changePhoto")}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={st.photo} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient
          colors={[BRAND.dark, BRAND.violet, BRAND.light]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={st.avatar}
        >
          <Text style={st.avatarTxt}>{initial}</Text>
        </LinearGradient>
      )}

      {/* Affordance : petit badge caméra (la photo se change au tap) */}
      <View style={st.cameraBadge}>
        <Feather name="camera" size={11} color="#fff" />
      </View>

      {busy && (
        <View style={st.busyOverlay}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      )}
    </Pressable>
  );
}

const SIZE = 76;

const st = StyleSheet.create({
  avatar: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    alignItems: "center" as const, justifyContent: "center" as const,
    ...SHADOW_RN.elev3,
  },
  photo: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  avatarTxt: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: "#fff", letterSpacing: -0.5 },
  cameraBadge: {
    position: "absolute" as const, right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: BRAND.violet,
    borderWidth: 2, borderColor: "#0B0B12",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
});
