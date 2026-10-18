import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View, type NativeSyntheticEvent, type TextLayoutEventData } from "react-native";
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

export const ZoneSynopsis = memo(function ZoneSynopsis({ synopsis, lines }: { synopsis: string; lines: number }) {
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
  const fitted = measured?.synopsis === synopsis ? fitPreviewZoneSynopsis(synopsis, synopsisBudget(measured.lengths, lines)) : null;
  return (
    <View style={styles.box}>
      <Text style={[text.body, styles.synopsis, styles.measure]} onTextLayout={onTextLayout} accessible={false}>
        {synopsis}
      </Text>
      {fitted ? (
        <Text style={[text.body, styles.synopsis]} numberOfLines={lines}>
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
  box: { width: ZONE_SYNOPSIS_WIDTH },
  synopsis: { width: ZONE_SYNOPSIS_WIDTH, color: white(0.86) },
  // Hors du flux, invisible : seule sa mise en page compte.
  measure: { position: "absolute", top: 0, left: 0, opacity: 0 },
});
