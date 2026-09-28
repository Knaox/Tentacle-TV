import { useCallback, useMemo, useState } from "react";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import type { CardSheetTarget } from "../../cards/cardSheet";
import { RecoActionSheet } from "./RecoActionSheet";

/**
 * Les feuilles d'appui long de l'accueil et de Pour vous, aiguillées selon ce
 * que la carte porte :
 *   • un titre de la bibliothèque — recommandation EN bibliothèque comprise —
 *     ouvre la feuille unique des cartes (`MediaActionSheet`, variante `reco`
 *     pour une recommandation : lecture, bascules, refus, note) ;
 *   • une recommandation HORS bibliothèque ouvre la feuille des cartes Vigie
 *     (`RecoActionSheet` → `ExternalActionSheet` : Demander, Ma liste à
 *     l'arrivée, note, refus).
 */
export function useItemSheets() {
  const [target, setTarget] = useState<CardSheetTarget | null>(null);
  const [external, setExternal] = useState<RecoRowItem | null>(null);
  const openMedia = useCallback((item: MediaItem) => setTarget({ kind: "media", variant: "poster", item }), []);
  const openReco = useCallback((reco: RecoRowItem) => {
    if (reco.jellyfinItemId) setTarget({ kind: "reco", reco });
    else setExternal(reco);
  }, []);
  const close = useCallback(() => setTarget(null), []);
  const closeExternal = useCallback(() => setExternal(null), []);
  const sheets = useMemo(
    () => (
      <>
        <MediaActionSheet target={target} onClose={close} />
        <RecoActionSheet item={external} onClose={closeExternal} />
      </>
    ),
    [target, external, close, closeExternal],
  );
  return { openMedia, openReco, sheets };
}
