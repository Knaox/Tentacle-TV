import { memo, useCallback, type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { LONG_PRESS_THRESHOLD_MS } from "@tentacle-tv/tv-core";
import { useFocusVisual } from "./focusPreview";

export interface FocusTargetProps {
  /** La clé que le banc sait figer (`useFocusVisual`). */
  focusKey?: string;
  onPress?: () => void;
  /** L'appui long (la feuille d'actions d'une carte). */
  onLongPress?: () => void;
  /** Prévient la vue parente : rangée qui recule, fond qui se teinte. */
  onFocusChange?: (focused: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: (focused: boolean) => ReactNode;
}

/**
 * La seule façon, dans la refonte, de rendre un élément focalisable : un
 * Pressable qui dit à ses enfants s'il porte le focus. Aucune décision de
 * focus ici — ni entrée, ni destination, ni Retour : c'est l'intégration qui
 * les posera.
 */
export const FocusTarget = memo(function FocusTarget({
  focusKey,
  onPress,
  onLongPress,
  onFocusChange,
  accessibilityLabel,
  disabled,
  style,
  children,
}: FocusTargetProps) {
  const { focused, onFocus, onBlur } = useFocusVisual(focusKey);
  const handleFocus = useCallback(() => {
    onFocus();
    onFocusChange?.(true);
  }, [onFocus, onFocusChange]);
  const handleBlur = useCallback(() => {
    onBlur();
    onFocusChange?.(false);
  }, [onBlur, onFocusChange]);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_THRESHOLD_MS}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {children(focused)}
    </Pressable>
  );
});
