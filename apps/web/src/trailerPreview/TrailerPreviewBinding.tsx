import { useEffect } from "react";
import { useConnectivity } from "../offline/useConnectivity";
import { useFormFactor } from "../mirror/useFormFactor";
import { setTrailerPreviewHostState } from "./previewEnvironment";
import { usePreviewWarm } from "./usePreviewWarm";

/**
 * Pousse dans le magasin de l'aperçu ce que l'app sait et que lui ne lit pas
 * seul : la connectivité (bureau hors ligne : rien à relayer) et le gabarit
 * (miroir téléphone ou tablette : pas de survol). Montée UNE fois près de la
 * racine (`AppBindings`) : chaque carte ne lit ensuite qu'un booléen. Elle
 * branche aussi la préparation des aperçus des titres à l'écran
 * (`usePreviewWarm`).
 *
 * Hors de l'index du module exprès : la connectivité tire `main.tsx` (l'adresse
 * du serveur), qu'une carte — ou un test de carte — n'a pas à charger.
 */
export function TrailerPreviewBinding(): null {
  const { state } = useConnectivity();
  const formFactor = useFormFactor();
  const offline = state === "offline-auto" || state === "offline-manual";
  const mirror = formFactor !== "desktop";
  useEffect(() => {
    setTrailerPreviewHostState({ offline, mirror });
  }, [offline, mirror]);
  usePreviewWarm();
  return null;
}
