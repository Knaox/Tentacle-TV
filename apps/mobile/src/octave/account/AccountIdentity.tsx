/**
 * Octave (mobile) — l'IDENTITÉ en tête du hub « Compte » : la photo (l'avatar du profil de Tentacle, repris tel
 * quel : son toucher ouvre la galerie des personnages ou « Importer une photo » ; hors ligne, un visage inerte),
 * le nom du profil en cours, le serveur. Le nom se change dans Jellyfin : il se lit, il ne s'édite pas.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useStoredUser } from "@/auth/useStoredUser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useOctaveColors } from "../theme/octaveColors";
import { useProfileFace } from "./useProfileFace";

/** Le serveur tel qu'on le reconnaît : son hôte, sans schéma ni chemin. */
function serverHost(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
}

export const AccountIdentity = memo(function AccountIdentity() {
  const { t } = useTranslation(["octaveShell", "profile"]);
  const colors = useOctaveColors();
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  const offline = useOfflineMode();
  const name = user?.Name ?? t("profile:defaultUsername");
  const host = serverHost(storage.getItem("tentacle_server_url") ?? "");
  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
      {/* Hors ligne, la photo ne se change pas : un visage inerte, sans badge ni toucher. */}
      {offline ? <StillFace /> : <ProfileAvatar user={user} initial={name.charAt(0).toUpperCase()} />}
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2} accessibilityRole="header">
          {name}
        </Text>
        {host ? <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{host}</Text> : null}
        {offline ? null : <Text style={[styles.hint, { color: colors.textTertiary }]}>{t("octaveShell:account.photoHint")}</Text>}
      </View>
    </View>
  );
});

const FACE = 76;

/** La photo du profil (copie locale) ou son initiale, à la taille de l'avatar : rien à toucher. */
function StillFace() {
  const colors = useOctaveColors();
  const face = useProfileFace();
  if (face.uri) return <Image key={face.imageKey} onLoad={face.onLoad} source={{ uri: face.uri }} style={styles.face} contentFit="cover" cachePolicy="none" onError={face.onError} accessibilityIgnoresInvertColors />;
  return (
    <LinearGradient colors={[...(face.stops ?? colors.gradient)] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.face}>
      <Text style={styles.initial}>{face.initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  face: { width: FACE, height: FACE, borderRadius: FACE / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initial: { color: "#ffffff", fontSize: 30, fontWeight: "800" },
  card: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, marginBottom: 24 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  sub: { fontSize: 14 },
  hint: { fontSize: 13, marginTop: 2 },
});
