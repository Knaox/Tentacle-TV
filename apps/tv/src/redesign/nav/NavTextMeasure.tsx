import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import type { NavTextWidths } from "./navGeometry";
import { navText } from "./navText";

/**
 * La MESURE des textes du rail, hors de l'écran : la largeur du rail ouvert
 * est celle de son intitulé le plus long (`navExpandedWidth`), en français
 * comme en anglais, avec la police et la graisse exactes de l'écran — Inter
 * gras pour les libellés (celle du focus, la plus large), Inter medium pour la
 * seconde ligne du profil.
 *
 * Une colonne par style, rétrécie à son texte le plus large : sa largeur EST
 * la mesure. Rien n'y est focalisable ni visible, et elle est loin à gauche de
 * l'écran — elle ne recouvre aucune cible du moteur de focus.
 */

export interface NavTextMeasureProps {
  labels: readonly string[];
  captions: readonly string[];
  onMeasure: (widths: NavTextWidths) => void;
}

type Measured = Partial<Record<keyof NavTextWidths, number>>;

export const NavTextMeasure = memo(function NavTextMeasure({ labels, captions, onMeasure }: NavTextMeasureProps) {
  const [measured, setMeasured] = useState<Measured>({});
  const keep = useCallback((key: keyof NavTextWidths, width: number) => {
    setMeasured((previous) => (previous[key] === width ? previous : { ...previous, [key]: width }));
  }, []);

  useEffect(() => {
    const ready = (key: keyof NavTextWidths, texts: readonly string[]) => texts.length === 0 || measured[key] !== undefined;
    if (!ready("label", labels) || !ready("caption", captions)) return;
    onMeasure({ label: labels.length ? measured.label ?? 0 : 0, caption: captions.length ? measured.caption ?? 0 : 0 });
  }, [measured, labels, captions, onMeasure]);

  return (
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Column texts={labels} style={navText.labelBold} onWidth={(width) => keep("label", width)} />
      <Column texts={captions} style={navText.caption} onWidth={(width) => keep("caption", width)} />
    </View>
  );
});

function Column({ texts, style, onWidth }: { texts: readonly string[]; style: StyleProp<TextStyle>; onWidth: (width: number) => void }) {
  const onLayout = useCallback((event: LayoutChangeEvent) => onWidth(Math.ceil(event.nativeEvent.layout.width)), [onWidth]);
  if (texts.length === 0) return null;
  return (
    <View style={styles.column} onLayout={onLayout}>
      {texts.map((text, index) => (
        <Text key={index} style={style} numberOfLines={1}>
          {text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Assez large pour qu'aucun texte n'y soit coupé ; loin de l'écran.
  offscreen: { position: "absolute", left: -10000, top: 0, width: 4000, opacity: 0 },
  column: { alignSelf: "flex-start" },
});
