import { memo, useCallback, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
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
 *
 * `expansion` : la carte peut devenir la GRANDE CARTE de l'aperçu (une
 * rangée, `trailerPreviewPort`). La cellule ELLE-MÊME grandit — sa largeur,
 * la place de l'image — et la rangée lui fait place : les voisines glissent,
 * rien ne se pose sur elles (tvOS ne propose pas un focalisable recouvert), et
 * la cible, qui couvre la cellule, reste la grande carte entière. Sa présence
 * ne change jamais pour une carte donnée (une rangée en donne une à toutes
 * ses cartes, une grille jamais) : l'arbre reste le même, le focus aussi.
 *
 * `glide` : la cellule GLISSE quand une voisine devient la grande carte (une
 * ligne de grille, `gridPreviewLine` — la grande carte en déborde, la cellule
 * garde sa taille). Le style animé porte sur la cellule elle-même : `front`
 * la pose toujours devant ses voisines. Présent pour toute la vie de la
 * carte, lui aussi.
 */

/** La grande carte : sa taille, et l'avancée de la croissance (0 → 1). */
export interface CardExpansion {
  width: number;
  height: number;
  progress: SharedValue<number>;
}

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
  /** La carte peut grandir en grande carte d'aperçu (cf. plus haut). */
  expansion?: CardExpansion;
  /** Le glissement de la cellule, quand une voisine de sa ligne grandit (cf. plus haut). */
  glide?: ReturnType<typeof useAnimatedStyle>;
}

export const CardShell = memo(function CardShell(props: CardShellProps) {
  const { focusKey, frameHeight, frame, centerFrame = false, onPress, onLongPress, onTargetFocusChange, accessibilityLabel, children } = props;
  const renderFrame = useCallback(
    () => (centerFrame ? <View style={styles.center}>{frame}</View> : frame),
    [centerFrame, frame],
  );
  const body = (
    <>
      {/* La place de l'image : elle se dessine dans la cible, plus bas. */}
      {props.expansion ? <ExpandingSpacer frameHeight={frameHeight} expansion={props.expansion} /> : <View style={{ height: frameHeight }} />}
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
    </>
  );
  if (props.expansion) return <ExpandingCell {...props} expansion={props.expansion}>{body}</ExpandingCell>;
  if (props.glide) {
    return (
      <Animated.View collapsable={false} style={[{ width: props.width }, props.front && styles.front, props.style, props.glide]}>
        {body}
      </Animated.View>
    );
  }
  return (
    // Jamais aplatie (`collapsable={false}`) : sur Android, `zIndex` posé au
    // focus ferait créer la vue et re-parenter la cible — qui perdait le focus.
    <View collapsable={false} style={[{ width: props.width }, props.front && styles.front, props.style]}>
      {body}
    </View>
  );
});

/** La cellule qui grandit : sa largeur suit la croissance, sur le fil d'interface. */
function ExpandingCell({ width, front, style, expansion, children }: CardShellProps & { expansion: CardExpansion; children: ReactNode }) {
  const { progress, width: wide } = expansion;
  const grow = useAnimatedStyle(() => ({ width: width + (wide - width) * progress.value }));
  return (
    <Animated.View collapsable={false} style={[{ width }, front && styles.front, style, grow]}>
      {children}
    </Animated.View>
  );
}

/** La place de l'image qui grandit avec la cellule : la légende descend d'autant. */
function ExpandingSpacer({ frameHeight, expansion }: { frameHeight: number; expansion: CardExpansion }) {
  const { progress, height: tall } = expansion;
  const grow = useAnimatedStyle(() => ({ height: frameHeight + (tall - frameHeight) * progress.value }));
  return <Animated.View style={[{ height: frameHeight }, grow]} />;
}

const styles = StyleSheet.create({
  front: { zIndex: 10 },
  center: { alignItems: "center" },
});
