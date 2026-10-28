/**
 * Octave (mobile) — l'AVATAR en tête des pages racines, comme celui d'Apple Music : la photo du profil en cours
 * (sinon son initiale), un rond de 36 pt dans une cible de 44. Le toucher ouvre le hub « Compte »
 * (`octavePaths.account`) : profil, réglages d'Octave, apparence, hors ligne, retour à Tentacle TV.
 */

import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { haptic } from "@/utils/haptics";
import { useOctaveColors } from "../theme/octaveColors";
import { useProfileFace } from "./useProfileFace";

const SIZE = 36;
const HIT_SLOP = 4;

export const OctaveAccountButton = memo(function OctaveAccountButton() {
  const { t } = useTranslation("octaveShell");
  const colors = useOctaveColors();
  const router = useRouter();
  const face = useProfileFace();
  const open = useCallback(() => {
    haptic("tap");
    router.push(octavePaths.account as Href);
  }, [router]);
  return (
    <Pressable
      onPress={open}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={face.name ? `${t("account.open")}, ${face.name}` : t("account.open")}
      accessibilityHint={t("account.openHint")}
      style={({ pressed }) => [styles.ring, { borderColor: colors.line }, pressed && styles.pressed]}
    >
      {face.uri ? (
        <Image key={face.imageKey} onLoad={face.onLoad} source={{ uri: face.uri }} style={styles.face} contentFit="cover" transition={150} onError={face.onError} />
      ) : (
        <LinearGradient colors={[...(face.stops ?? colors.gradient)] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.face}>
          <Text style={styles.initial}>{face.initial}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  ring: { width: SIZE + 4, height: SIZE + 4, borderRadius: (SIZE + 4) / 2, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  face: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initial: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
