import { useEffect, useState } from "react";

/**
 * L'élément où monter une couche qui doit rester visible PAR-DESSUS tout,
 * plein écran compris.
 *
 * Le lecteur web met en plein écran son seul conteneur
 * (`containerRef.requestFullscreen()`) : le navigateur ne rend alors QUE ce
 * sous-arbre. Une couche montée sur `document.body` disparaît — c'était le cas
 * des messages de l'administrateur, invisibles devant un film en plein écran.
 * Le portail suit donc `document.fullscreenElement` quand il existe.
 */
export function useFullscreenPortalTarget(): HTMLElement {
  const [target, setTarget] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
    const onFullscreenChange = () => {
      setTarget((document.fullscreenElement as HTMLElement | null) ?? document.body);
    };
    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  return target;
}
