import type { ElementRef, Ref } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BACKGROUND_FOCUS } from "../../../components/player/focus/osdFocusBus";

/**
 * Le FOND du lecteur (Apple TV) : la surface focalisable plein écran qui tient
 * les flèches habillage caché — le saut n'appartient à la vidéo que là — et
 * dont l'appui rallume l'habillage. Il APPLIQUE la règle de tv-core
 * (`playerBackgroundFocus`) : focalisable, préféré et accessible ensemble ;
 * caché à l'accessibilité sous ce qui le recouvre.
 */
export function PlayerBackground({ backgroundRef, holdsFocus, covered, onPress }: {
  backgroundRef: Ref<ElementRef<typeof TouchableOpacity>>;
  /** Focalisable, préféré et accessible (tv-core `playerBackgroundFocus`). */
  holdsFocus: boolean;
  covered: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      ref={backgroundRef}
      {...BACKGROUND_FOCUS}
      activeOpacity={1}
      style={StyleSheet.absoluteFill}
      onPress={onPress}
      hasTVPreferredFocus={holdsFocus}
      focusable={holdsFocus}
      accessible={holdsFocus}
      importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
    >
      <View style={styles.fill} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
