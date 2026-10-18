import { Fragment, memo, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
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

export const MetaLine = memo(function MetaLine({ items, size = 24, singleLine = false }: {
  items: MetaItem[];
  size?: number;
  /**
   * Une seule ligne (la zone d'aperçu) : jamais renvoyé à la ligne, et ce qui ne
   * tient pas ENTIER disparaît — un badge n'est jamais coupé en son milieu.
   */
  singleLine?: boolean;
}) {
  const fit = useFit(singleLine);
  return (
    <View style={[styles.row, singleLine && styles.single]} onLayout={fit?.onRowLayout}>
      {items.map((item, index) => {
        const previous = items[index - 1];
        const needsDot = index > 0 && !(typeof item === "object" && "badge" in item && typeof previous === "object" && previous && "badge" in previous);
        const dot = needsDot ? <Text style={[styles.text, { fontSize: size }]}>·</Text> : null;
        // Clé de PLACE : une ligne qui change de titre (la zone d'aperçu, à chaque flèche) met ses
        // textes à jour sur place au lieu de les recréer ; seul un élément qui change de genre se remonte.
        if (fit) {
          return (
            <View key={index} style={[styles.cell, fit.hidden(index) && styles.cut]} onLayout={fit.onCellLayout(index)}>
              {dot}
              <Item item={item} size={size} />
            </View>
          );
        }
        return (
          <Fragment key={index}>
            {dot}
            <Item item={item} size={size} />
          </Fragment>
        );
      })}
    </View>
  );
});

function Item({ item, size }: { item: MetaItem; size: number }) {
  if (typeof item === "string") return <Text style={[styles.text, { fontSize: size }]}>{item}</Text>;
  if ("badge" in item) {
    return (
      <View style={[styles.badge, item.strong && styles.badgeStrong]}>
        <Text style={[styles.badgeText, { fontSize: size - 3 }, item.strong && styles.badgeTextStrong]}>{item.badge}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rating}>
      <Svg width={size - 2} height={size - 2} viewBox={STAR_VIEWBOX}>
        <Path d={STAR_PATH} fill={colors.accentLight} />
      </Svg>
      <Text style={[styles.text, styles.ratingText, { fontSize: size }]}>{item.rating}</Text>
    </View>
  );
}

/**
 * Ce qui tient sur la ligne : la largeur de la ligne et le bord droit de chaque
 * élément, mesurés ; un élément qui dépasse est caché (avec son point). La
 * mesure se refait à chaque mise en page — dans la zone d'aperçu, à chaque
 * changement de titre : les bords mesurés s'accumulent et ne font qu'UN rendu
 * par image (jamais un par élément). Un élément pas encore mesuré reste caché
 * (la ligne connue) : rien ne s'allume une image à droite avant d'être caché.
 */
function useFit(on: boolean) {
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [rights, setRights] = useState<ReadonlyMap<number, number>>(() => new Map());
  const pending = useRef(new Map<number, number>());
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const flush = useCallback(() => {
    frame.current = null;
    const measured = pending.current;
    pending.current = new Map();
    setRights((before) => {
      let changed = false;
      const next = new Map(before);
      measured.forEach((right, index) => {
        if (next.get(index) === right) return;
        next.set(index, right);
        changed = true;
      });
      return changed ? next : before;
    });
  }, []);
  const handlers = useRef(new Map<number, (event: LayoutChangeEvent) => void>());
  const onRowLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setRowWidth((before) => (before === width ? before : width));
  }, []);
  const onCellLayout = useCallback(
    (index: number) => {
      const known = handlers.current.get(index);
      if (known) return known;
      const handler = (event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        pending.current.set(index, Math.ceil(x + width));
        if (frame.current === null) frame.current = requestAnimationFrame(flush);
      };
      handlers.current.set(index, handler);
      return handler;
    },
    [flush],
  );
  if (!on) return null;
  return {
    onRowLayout,
    onCellLayout,
    hidden: (index: number) => {
      if (rowWidth === null) return false;
      const right = rights.get(index);
      return right === undefined || right > rowWidth;
    },
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 14, rowGap: 10 },
  single: { flexWrap: "nowrap", overflow: "hidden" },
  cell: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  cut: { opacity: 0 },
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
