import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform, type KeyboardEvent, type LayoutChangeEvent } from "react-native";
import { keyboardCover, liftedSnapHeights, sheetKeyboardLift } from "./sheetKeyboard";

/** Durée de la montée quand le système n'en donne pas (Android). */
const FALLBACK_MS = 220;

interface SheetKeyboardInput {
  enabled: boolean;
  snapHeights: readonly [number, number];
  topInset: number;
  bottomInset: number;
}

/**
 * La feuille du bas suit le clavier (`BottomSheet avoidKeyboard`) : elle écoute le clavier, mesure sa modale,
 * et rend de combien la soulever (`liftStyle`, sur le fil natif, au rythme du clavier) et ses crans bornés à la
 * place restante (`sheetKeyboard.ts`). iOS : `keyboardWill*` (la feuille monte AVEC le clavier) ; Android :
 * `keyboardDid*`, seuls émis.
 */
export function useSheetKeyboard({ enabled, snapHeights, topInset, bottomInset }: SheetKeyboardInput) {
  const [cover, setCover] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  // La modale SANS clavier : ce que le système en retire ensuite est déjà « évité ».
  const restHeight = useRef(0);
  const duration = useRef(FALLBACK_MS);
  const liftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return undefined;
    const ios = Platform.OS === "ios";
    const onShow = (e: KeyboardEvent) => {
      duration.current = e.duration > 0 ? e.duration : FALLBACK_MS;
      setCover(keyboardCover(Platform.OS, e.endCoordinates.height, bottomInset));
    };
    const onHide = (e: KeyboardEvent) => {
      duration.current = e.duration > 0 ? e.duration : FALLBACK_MS;
      setCover(0);
    };
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", onShow),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", onHide),
    ];
    if (ios) subs.push(Keyboard.addListener("keyboardWillChangeFrame", onShow));
    return () => subs.forEach((s) => s.remove());
  }, [enabled, bottomInset]);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setRootHeight(h);
    if (!Keyboard.isVisible() || h > restHeight.current) restHeight.current = h;
  }, []);

  const lift = enabled ? sheetKeyboardLift(cover, restHeight.current || rootHeight, rootHeight) : 0;

  useEffect(() => {
    Animated.timing(liftY, {
      toValue: -lift,
      duration: duration.current,
      easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      useNativeDriver: true,
    }).start();
  }, [lift, liftY]);

  const [minH, maxH] = liftedSnapHeights(snapHeights, rootHeight, lift, topInset);
  return { onRootLayout, liftStyle: { transform: [{ translateY: liftY }] }, lifted: lift > 0, minH, maxH };
}
