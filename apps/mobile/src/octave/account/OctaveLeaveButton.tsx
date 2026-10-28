/**
 * Octave (mobile) — la BASCULE vers Tentacle TV, en tête des pages racines, juste à GAUCHE de l'avatar (retour
 * de Damien, 28/10 soir) : un rond de verre de la taille de l'avatar (40 pt, cible 48), le poulpe de Tentacle TV
 * dedans. Plus dans le hub « Compte » : une seule porte, toujours sous le pouce, là où l'on change de profil.
 */

import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "@/components/TentacleLogo";
import { OctaveGlass } from "../layout/OctaveGlass";
import { useLeaveOctave } from "../mode/useOctaveSwitch";

const SIZE = 40;
const LOGO = 30;

export const OctaveLeaveButton = memo(function OctaveLeaveButton() {
  const { t } = useTranslation("octaveShell");
  const leave = useLeaveOctave();
  return (
    <OctaveGlass radius={SIZE / 2} style={styles.round} interactive>
      <Pressable
        onPress={leave}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t("account.leave")}
        accessibilityHint={t("account.leaveHint")}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      >
        <TentacleLogo size={LOGO} />
      </Pressable>
    </OctaveGlass>
  );
});

const styles = StyleSheet.create({
  round: { width: SIZE, height: SIZE },
  hit: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
