import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";
import { useChromeVeil } from "@/components/navigation/scrollChrome";

type InjectableWebView = { injectJavaScript: (js: string) => void };

/**
 * Les surfaces modales d'une page d'extension (message `OVERLAY`, cf.
 * `pluginHostBridgeScript`) traduites en voile du chrome natif : la barre
 * d'onglets s'efface, l'en-tête s'assombrit, et un toucher sur le voile — ou le
 * retour Android — ferme la surface du dessus.
 *
 * Le voile n'appartient qu'au volet ACTIF d'un écran AU FOCUS : un volet
 * caché ou un onglet quitté rend le chrome, et le retrouve voilé au retour si
 * son panneau est toujours ouvert.
 */
export function usePluginOverlay(webRef: RefObject<InjectableWebView | null>, active: boolean) {
  const setVeil = useChromeVeil()?.set ?? null;
  // L'écran a-t-il le focus ? (`useIsFocused` vit dans @react-navigation/native,
  // que le mobile ne déclare pas : expo-router en expose l'équivalent.)
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const [open, setOpen] = useState(false);

  const closeTop = useCallback(() => {
    webRef.current?.injectJavaScript("window.__tentacleCloseOverlay && window.__tentacleCloseOverlay(); true;");
  }, [webRef]);

  const onOverlay = useCallback((next: boolean) => { setOpen(next); }, []);
  /** La page a été rechargée (erreur, réessai) : ses panneaux n'existent plus. */
  const resetOverlay = useCallback(() => { setOpen(false); }, []);

  const veiled = open && active && focused;
  const ownsVeil = useRef(false);
  useEffect(() => {
    if (!setVeil) return;
    if (veiled) {
      ownsVeil.current = true;
      setVeil(closeTop);
    } else if (ownsVeil.current) {
      ownsVeil.current = false;
      setVeil(null);
    }
  }, [veiled, setVeil, closeTop]);
  // Démonté voilé (onglet retiré, plugin désactivé) : le chrome revient.
  useEffect(() => () => { if (ownsVeil.current) setVeil?.(null); }, [setVeil]);

  useEffect(() => {
    if (!veiled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { closeTop(); return true; });
    return () => sub.remove();
  }, [veiled, closeTop]);

  return { onOverlay, resetOverlay, veiled };
}
