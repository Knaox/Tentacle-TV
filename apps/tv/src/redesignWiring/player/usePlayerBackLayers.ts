import { useCallback, useEffect, useState } from "react";
import { useBackLayer } from "../back/BackScope";
import type { PlayerRedesignStageProps } from "./playerStageTypes";

/**
 * L'habillage ÉPINGLÉ par la pause, tant que Retour ne l'a pas masqué.
 *
 * En pause, l'habillage reste affiché. Retour le masque quand même — la
 * surimpression d'abord, la sortie ensuite, comme en lecture — et le moindre
 * geste qui le rallume (`showOverlay`), comme une reprise, l'épingle de
 * nouveau.
 */
export function useOsdPin(paused: boolean, overlayVisible: boolean): { pinned: boolean; unpin: () => void } {
  const [unpinned, setUnpinned] = useState(false);
  useEffect(() => {
    if (overlayVisible) setUnpinned(false);
  }, [overlayVisible]);
  useEffect(() => setUnpinned(false), [paused]);
  const unpin = useCallback(() => setUnpinned(true), []);
  return { pinned: paused && !unpinned, unpin };
}

/**
 * Les couches du Retour du lecteur (Apple TV), dans l'ordre de la pile
 * (`BackScope`) :
 *
 * - menu : un état passager — le défilement (Retour revient où l'on était,
 *   comme avant), la carte « à suivre », un passage automatique à refuser,
 *   la grâce d'un double appui (`useTVPlayerBack`) —, la feuille des pistes
 *   et des réglages (un seul état, `showSettings`, pour ses deux onglets),
 *   le panneau des épisodes : Retour ferme le menu, la lecture continue ;
 * - surimpression : l'habillage AFFICHÉ (`osdShown`, la règle de la vue) se
 *   masque, la lecture continue ;
 * - page : rien d'affiché — Retour quitte la lecture, comme la croix.
 *
 * Aucun retrait d'écran n'est retenu : Menu ne dépile plus le lecteur de
 * lui-même, rien ne paraît dessous pendant qu'un menu se ferme.
 */
export function usePlayerBackLayers(p: PlayerRedesignStageProps, osd: { shown: boolean; unpin: () => void }): void {
  const { back } = p;
  useBackLayer("menu", !!back?.transient, () => void back?.routeBack());
  useBackLayer("menu", p.showSettings, p.onCloseSettings);
  useBackLayer("menu", !!p.showEpisodes, () => p.onCloseEpisodes?.());
  const { unpin } = osd;
  const hideOsd = useCallback(() => {
    back?.hideOverlay();
    unpin();
  }, [back, unpin]);
  useBackLayer("overlay", osd.shown, hideOsd);
  useBackLayer("page", true, p.onBack);
}
