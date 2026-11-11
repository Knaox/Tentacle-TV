import { useEffect } from "react";
import { declareTrailerDecodes, useServerCapability } from "@tentacle-tv/api-client";
import { useConnectivity } from "../offline/useConnectivity";
import { useFormFactor } from "../mirror/useFormFactor";
import { probePreviewDecodes } from "./previewDecode";
import { setTrailerPreviewDecodes, setTrailerPreviewHostState, setTrailerPreviewServerOpenCodecs } from "./previewEnvironment";
import { usePreviewWarm } from "./usePreviewWarm";

// Ce que le lecteur de ce navigateur décode, déclaré UNE fois, au chargement — avant le premier
// rendu : la première requête d'une bande-annonce (aperçu, préparation, lecteur de la fiche) le
// porte déjà. Sans H.264 ni AAC (le bureau CEF), le relais sert du VP9 + Opus s'il sait ; un
// lecteur qui ne lirait rien ne demande rien (`previewDecode.ts`).
const decodes = probePreviewDecodes();
declareTrailerDecodes(decodes);
setTrailerPreviewDecodes(decodes);

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
  // Un lecteur sans H.264 (bureau CEF) n'a d'aperçu que face à un serveur qui sert le VP9 et l'Opus :
  // le blocage `codec` le dit à TOUT ce qui montre un aperçu, extensions comprises.
  const openCodecs = useServerCapability("trailers.openCodecs");
  useEffect(() => {
    setTrailerPreviewServerOpenCodecs(openCodecs);
  }, [openCodecs]);
  usePreviewWarm();
  return null;
}
