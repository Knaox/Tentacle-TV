import { memo, useCallback, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type NativeSyntheticEvent, type StyleProp, type TextLayoutEventData, type TextStyle } from "react-native";
import { fitPreviewZoneSynopsis, synopsisBudget } from "@tentacle-tv/tv-core";

interface Props {
  text: string;
  /** Les lignes accordées au résumé. */
  lines: number;
  style: StyleProp<TextStyle>;
  /** Ce qui s'affiche quand rien ne tient sans couper un mot. */
  fallback?: ReactNode;
}

/**
 * Un résumé qui ne coupe jamais un mot — la règle de la TV : le texte entier
 * s'il tient, sinon ses phrases entières, sinon une articulation suivie de
 * « … », sinon rien (`fitPreviewZoneSynopsis`, tv-core). Le texte complet est
 * mesuré une fois, invisible, à la largeur de la place ; seul ce qui tient est
 * dessiné. Avant la mesure, la place reste vide (aucune coupure entrevue).
 */
export const WholeText = memo(function WholeText({ text, lines, style, fallback = null }: Props) {
  const [fitted, setFitted] = useState<string | null | undefined>(undefined);
  const onTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const budget = synopsisBudget(e.nativeEvent.lines.map((line) => line.text.length), lines);
    setFitted(fitPreviewZoneSynopsis(text, budget));
  }, [text, lines]);
  return (
    <View>
      <Text style={[style, st.measure]} onTextLayout={onTextLayout} accessible={false} importantForAccessibility="no-hide-descendants">{text}</Text>
      {fitted ? <Text style={style} numberOfLines={lines}>{fitted}</Text> : fitted === null ? fallback : null}
    </View>
  );
});

const st = StyleSheet.create({
  // Mesuré à la largeur de la place, sans rien occuper ni montrer.
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
});
