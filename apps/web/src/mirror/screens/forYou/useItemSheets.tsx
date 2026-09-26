import { useCallback, useMemo, useState } from "react";
import type { RecoReason, RecoRowItem } from "@tentacle-tv/api-client";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import { RecoActionSheet, RecoReasonList } from "./RecoActionSheet";

/**
 * Les deux feuilles d'appui long de l'accueil et de Pour vous : un titre en
 * bibliothèque ouvre `MediaActionSheet` (favoris, Ma liste, vu) ; une
 * recommandation hors bibliothèque, `RecoActionSheet` (« Ne plus me proposer »).
 */
export function useItemSheets() {
  const [mediaId, setMediaId] = useState<string | null>(null);
  // Une reco déjà en bibliothèque garde ses raisons sous le bandeau, comme dans l'app.
  const [reasons, setReasons] = useState<readonly RecoReason[] | undefined>(undefined);
  const [recoTarget, setRecoTarget] = useState<RecoRowItem | null>(null);
  const openMedia = useCallback((jellyfinId: string, why?: readonly RecoReason[]) => {
    setReasons(why);
    setMediaId(jellyfinId);
  }, []);
  const openReco = useCallback((item: RecoRowItem) => {
    if (item.jellyfinItemId) {
      setReasons(item.reasons);
      setMediaId(item.jellyfinItemId);
    } else setRecoTarget(item);
  }, []);
  const closeMedia = useCallback(() => setMediaId(null), []);
  const closeReco = useCallback(() => setRecoTarget(null), []);
  const sheets = useMemo(
    () => (
      <>
        <MediaActionSheet
          itemId={mediaId}
          onClose={closeMedia}
          extra={reasons && reasons.length > 0 ? <RecoReasonList reasons={reasons} /> : undefined}
        />
        <RecoActionSheet item={recoTarget} onClose={closeReco} />
      </>
    ),
    [mediaId, reasons, recoTarget, closeMedia, closeReco],
  );
  return { openMedia, openReco, sheets };
}
