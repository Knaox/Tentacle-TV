import { memo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { fonts, white } from "../../theme/tokens";
import { profileStops } from "./profileColors";

/**
 * Le rond d'un profil : son portrait Jellyfin quand il en a un, sinon son
 * initiale blanche sur le dégradé de sa couleur. L'initiale est toujours
 * dessous : un portrait absent (404) ou injoignable la laisse paraître, jamais
 * un cercle vide.
 */
export const ProfileAvatar = memo(function ProfileAvatar({ name, color, uri, size }: {
  name: string;
  color: FamilyProfileColor | null;
  uri?: string;
  size: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const [from, to] = profileStops(color);
  return (
    <View style={[round, styles.ring]}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[round, styles.center]}>
        <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.5 }]}>{initialOf(name)}</Text>
      </LinearGradient>
      {uri && failed !== uri ? (
        <Image source={{ uri }} style={[round, StyleSheet.absoluteFill]} fadeDuration={0} onError={() => setFailed(uri)} />
      ) : null}
    </View>
  );
});

/** La première lettre (ou le premier signe) du nom, en capitale. */
function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: white(0.16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  center: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { ...fonts.extrabold, color: "#fff" },
});
