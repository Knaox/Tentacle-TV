import { memo, useCallback, useRef, type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { LONG_PRESS_THRESHOLD_MS } from "@tentacle-tv/tv-core";
import { useFocusBinding } from "./focusBinding";
import { useFocusVisual } from "./focusPreview";

export interface FocusTargetProps {
  /** La clé que le banc sait figer (`useFocusVisual`) et que l'intégration
   *  lie par le port du focus (`focusBinding`). */
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
 * focus ici — ni entrée, ni destination, ni Retour : l'intégration les pose
 * par le port du focus (`useFocusBinding(focusKey)` : ref, props natives,
 * garde anti-clic fantôme, observation).
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
  const binding = useFocusBinding(focusKey);
  const bindingFocus = binding?.onFocus;
  const bindingBlur = binding?.onBlur;
  const guarded = binding?.phantomPressGuard === true;
  const pressedIn = useRef(false);

  const handleFocus = useCallback(() => {
    onFocus();
    bindingFocus?.();
    onFocusChange?.(true);
  }, [onFocus, bindingFocus, onFocusChange]);
  const handleBlur = useCallback(() => {
    onBlur();
    // Un appui commencé ici puis emporté ailleurs ne doit pas valider plus tard.
    pressedIn.current = false;
    bindingBlur?.();
    onFocusChange?.(false);
  }, [onBlur, bindingBlur, onFocusChange]);
  const handlePressIn = useCallback(() => {
    pressedIn.current = true;
  }, []);
  const handlePress = useCallback(() => {
    if (guarded && !pressedIn.current) return; // clic fantôme : ignoré
    pressedIn.current = false;
    onPress?.();
  }, [guarded, onPress]);

  return (
    <Pressable
      // Les props natives de l'intégration d'abord : elles ne remplacent
      // jamais les gestionnaires de la vue.
      {...binding?.native}
      ref={binding?.ref}
      onPressIn={handlePressIn}
      onPress={onPress ? handlePress : undefined}
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
