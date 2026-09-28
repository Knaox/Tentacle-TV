import { useCallback, useMemo, useState } from "react";
import { recoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import type { CardSheetTarget } from "../../cards/cardSheet";
import { RecoActionSheet } from "./RecoActionSheet";

/**
 * Les deux feuilles d'appui long de l'accueil et de Pour vous : un titre en
 * bibliothèque ouvre `MediaActionSheet` (lecture, bascules, note) ; une
 * recommandation hors bibliothèque, `RecoActionSheet` (« Ne plus me proposer »).
 */
export function useItemSheets() {
  const [target, setTarget] = useState<CardSheetTarget | null>(null);
  const [recoTarget, setRecoTarget] = useState<RecoRowItem | null>(null);
  const openMedia = useCallback((item: MediaItem) => setTarget({ kind: "media", variant: "poster", item }), []);
  const openReco = useCallback((item: RecoRowItem) => {
    // Une reco déjà en bibliothèque garde ses raisons sous le bandeau, comme
    // dans l'app ; la feuille relit la fiche complète de son visage.
    if (item.jellyfinItemId) setTarget({ kind: "media", variant: "poster", item: recoMarkerItem(item), reasons: item.reasons });
    else setRecoTarget(item);
  }, []);
  const closeMedia = useCallback(() => setTarget(null), []);
  const closeReco = useCallback(() => setRecoTarget(null), []);
  const sheets = useMemo(
    () => (
      <>
        <MediaActionSheet target={target} onClose={closeMedia} />
        <RecoActionSheet item={recoTarget} onClose={closeReco} />
      </>
    ),
    [target, recoTarget, closeMedia, closeReco],
  );
  return { openMedia, openReco, sheets };
}
