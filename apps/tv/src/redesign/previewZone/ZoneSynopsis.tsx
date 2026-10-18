import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View, type NativeSyntheticEvent, type StyleProp, type TextLayoutEventData, type TextStyle } from "react-native";
import { fitPreviewZoneSynopsis, synopsisBudget } from "@tentacle-tv/tv-core";
import { text, white } from "../theme/tokens";

/**
 * Le SYNOPSIS de la zone d'aperçu, jamais coupé au milieu d'un mot : le texte
 * complet est posé, invisible, à la même largeur — ses lignes mesurées disent
 * combien de caractères tiennent dans les `lines` lignes de la zone, et
 * tv-core (`fitPreviewZoneSynopsis`) en garde les phrases entières (sinon une
 * articulation, sinon rien). Avant la mesure (une image), rien ne s'affiche.
 */

export const ZONE_SYNOPSIS_WIDTH = 780;

export const ZoneSynopsis = memo(function ZoneSynopsis({ synopsis, lines, width = ZONE_SYNOPSIS_WIDTH, textStyle, clauses = true }: {
  synopsis: string;
  lines: number;
  /** La largeur du texte (la mesure se fait à la même). */
  width?: number;
  /** La police, si ce n'est pas celle du corps (`text.body`). */
  textStyle?: StyleProp<TextStyle>;
  /** Une articulation suivie de « … » en dernier recours ; sinon, des phrases entières ou rien. */
  clauses?: boolean;
}) {
  // Les longueurs des lignes posées, pour CE synopsis (un autre titre remesure).
  const [measured, setMeasured] = useState<{ synopsis: string; lengths: number[] } | null>(null);
  const onTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lengths = event.nativeEvent.lines.map((line) => line.text.length);
      setMeasured((previous) =>
        previous && previous.synopsis === synopsis && sameLengths(previous.lengths, lengths) ? previous : { synopsis, lengths },
      );
    },
    [synopsis],
  );
  const fitted = measured?.synopsis === synopsis ? fitPreviewZoneSynopsis(synopsis, synopsisBudget(measured.lengths, lines), { clauses }) : null;
  return (
    <View style={{ width }}>
      <Text style={[text.body, styles.synopsis, textStyle, { width }, styles.measure]} onTextLayout={onTextLayout} accessible={false}>
        {synopsis}
      </Text>
      {fitted ? (
        <Text style={[text.body, styles.synopsis, textStyle, { width }]} numberOfLines={lines}>
          {fitted}
        </Text>
      ) : null}
    </View>
  );
});

function sameLengths(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((length, index) => length === b[index]);
}

const styles = StyleSheet.create({
  synopsis: { color: white(0.86) },
  // Hors du flux, invisible : seule sa mise en page compte.
  measure: { position: "absolute", top: 0, left: 0, opacity: 0 },
});
