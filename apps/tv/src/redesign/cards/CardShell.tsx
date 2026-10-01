import { memo, useCallback, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { FocusTarget } from "../focus/FocusTarget";

/**
 * L'ossature d'une carte focalisable : sa LÉGENDE, puis sa cible
 * (`FocusTarget form="card"`), qui couvre la carte entière — image et légende
 * — mais ne porte que l'IMAGE.
 *
 * - Rien ne recouvre la cible : tvOS ne propose pas au focus un élément
 *   recouvert par ce qui dessine, et fait défiler jusqu'à rendre visible tout
 *   le cadre de la cible — la légende avec l'image.
 * - Seule l'image suit le pouce : la parallaxe d'Apple TV se joue sur la vue
 *   focalisée ; la légende, dessinée avant la cible et hors d'elle, ne
 *   s'incline jamais.
 *
 * Ce que la carte dessine hors de la cible (légende, indication) lit son focus
 * chez l'appelant (`useCardFocused`), qui passe ici `onTargetFocusChange`.
 */

export interface CardShellProps {
  focusKey?: string;
  /** La largeur de la carte (la cellule). */
  width: number;
  /** La hauteur de l'image : la légende commence dessous. */
  frameHeight: number;
  /** L'image (`CardFrame`…), dessinée DANS la cible, en haut. */
  frame: ReactNode;
  /** L'image centrée dans la largeur (un portrait rond dans sa cellule). */
  centerFrame?: boolean;
  /** La carte focalisée passe devant ses voisines (son ombre n'est pas recouverte). */
  front?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onTargetFocusChange: (focused: boolean) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** La légende, dessinée SOUS la cible. */
  children?: ReactNode;
}

export const CardShell = memo(function CardShell({
  focusKey,
  width,
  frameHeight,
  frame,
  centerFrame = false,
  front = false,
  onPress,
  onLongPress,
  onTargetFocusChange,
  accessibilityLabel,
  style,
  children,
}: CardShellProps) {
  const renderFrame = useCallback(
    () => (centerFrame ? <View style={styles.center}>{frame}</View> : frame),
    [centerFrame, frame],
  );
  return (
    <View style={[{ width }, front && styles.front, style]}>
      {/* La place de l'image : elle se dessine dans la cible, plus bas. */}
      <View style={{ height: frameHeight }} />
      {children}
      {/* En DERNIER : rien ne recouvre la cible. L'appui (OK enfoncé) qu'elle
          tient, l'image le lit (`usePressProgress`). */}
      <FocusTarget
        focusKey={focusKey}
        form="card"
        onPress={onPress}
        onLongPress={onLongPress}
        onFocusChange={onTargetFocusChange}
        accessibilityLabel={accessibilityLabel}
        style={StyleSheet.absoluteFill}
      >
        {renderFrame}
      </FocusTarget>
    </View>
  );
});

const styles = StyleSheet.create({
  front: { zIndex: 10 },
  center: { alignItems: "center" },
});
