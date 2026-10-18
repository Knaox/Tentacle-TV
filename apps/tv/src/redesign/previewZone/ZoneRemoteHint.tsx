import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { previewRemoteHintIds } from "@tentacle-tv/tv-core";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";
import { useRemoteHints } from "../remote/remoteHints";

/**
 * « Lecture/Pause : pause · maintenir : couper le son » — dans la colonne de
 * gauche de la ZONE D'APERÇU (`ZoneWatchText`), jamais sur l'image, dans la
 * voix basse de « Maintenir OK : plus d'options » (`CardHoldHint`) : une
 * ligne sur le noir, sans pastille, rien de focalisable. Le
 * pictogramme est celui de ce que fera la touche (pause, ou reprise) ; les
 * deux moitiés suivent l'état (tv-core `previewRemoteHintIds`), les mots
 * viennent de la table de la télécommande.
 *
 * Le contenu seul : QUAND il se lit, c'est `useZoneHint` (tv-core `previewZoneHintShown`).
 */
export const ZoneRemoteHint = memo(function ZoneRemoteHint({ paused, muted }: { paused: boolean; muted: boolean }) {
  const { t } = useTranslation("cards");
  const hints = useRemoteHints();
  const [press, hold] = previewRemoteHintIds({ paused, muted });
  return (
    <View style={styles.hint}>
      <Icon name={paused ? "play" : "pause"} size={22} color={colors.textSecondary} strokeWidth={1.8} />
      <Text style={styles.text} numberOfLines={1}>{`${t(hints[press])} · ${t(hints[hold])}`}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // Sur le noir de la colonne : pas de pastille, la voix basse suffit.
  hint: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { ...fonts.medium, flexShrink: 1, fontSize: 20, lineHeight: 26, color: colors.textSecondary },
});
