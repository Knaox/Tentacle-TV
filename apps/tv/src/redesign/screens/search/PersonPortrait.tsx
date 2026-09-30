import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts, white } from "../../theme/tokens";

/**
 * Le portrait rond d'une personne ; ses initiales quand Jellyfin n'a pas de
 * photo. Le cercle se lit comme « une personne » avant même le nom.
 */
export const PersonPortrait = memo(function PersonPortrait({
  uri,
  initials,
  size,
}: {
  uri?: string;
  initials: string;
  size: number;
}) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[shape, styles.frame]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, styles.ring]} />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3 },
  initials: { ...fonts.bold, color: colors.textSecondary },
  ring: { borderWidth: 1, borderColor: white(0.14) },
});
