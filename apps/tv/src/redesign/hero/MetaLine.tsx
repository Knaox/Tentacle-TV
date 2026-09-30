import { Fragment, memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { colors, fonts, white } from "../theme/tokens";

/**
 * La ligne de métadonnées : « 2026 · 16+ · 2 saisons · Thriller ».
 * - un texte simple ;
 * - `badge` : cadré d'un liseré (classification, 4K, HDR, Atmos, VF…) —
 *   des pastilles de texte, jamais des drapeaux ;
 * - `rating` : l'étoile et la note globale.
 * Les éléments texte sont séparés par un point médian ; les pastilles se
 * suivent sans séparateur.
 */

export type MetaItem = string | { badge: string; strong?: boolean } | { rating: string };

export const MetaLine = memo(function MetaLine({ items, size = 24 }: { items: MetaItem[]; size?: number }) {
  return (
    <View style={styles.row}>
      {items.map((item, index) => {
        const previous = items[index - 1];
        const needsDot = index > 0 && !(typeof item === "object" && "badge" in item && typeof previous === "object" && previous && "badge" in previous);
        return (
          <Fragment key={`${index}-${JSON.stringify(item)}`}>
            {needsDot ? <Text style={[styles.text, { fontSize: size }]}>·</Text> : null}
            {typeof item === "string" ? (
              <Text style={[styles.text, { fontSize: size }]}>{item}</Text>
            ) : "badge" in item ? (
              <View style={[styles.badge, item.strong && styles.badgeStrong]}>
                <Text style={[styles.badgeText, { fontSize: size - 3 }, item.strong && styles.badgeTextStrong]}>{item.badge}</Text>
              </View>
            ) : (
              <View style={styles.rating}>
                <Svg width={size - 2} height={size - 2} viewBox={STAR_VIEWBOX}>
                  <Path d={STAR_PATH} fill={colors.accentLight} />
                </Svg>
                <Text style={[styles.text, styles.ratingText, { fontSize: size }]}>{item.rating}</Text>
              </View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 14, rowGap: 10 },
  text: { ...fonts.medium, color: white(0.84) },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: white(0.55),
  },
  badgeStrong: { backgroundColor: white(0.92), borderColor: white(0.92) },
  badgeText: { ...fonts.bold, color: white(0.9), letterSpacing: 0.4 },
  badgeTextStrong: { color: colors.ctaFg },
  rating: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { ...fonts.semibold, color: colors.text },
});
