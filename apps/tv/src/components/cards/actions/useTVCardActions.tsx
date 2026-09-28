import { useCallback, useState } from "react";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVCardActionSheet } from "./TVCardActionSheet";
import type { CardSheetTarget } from "./cardSheetTarget";

/**
 * La feuille d'actions d'un ÉCRAN : ses trois ouvertures — une par variante du
 * modèle — à brancher sur l'appui long des cartes, et la feuille à rendre.
 *
 * Montée DANS l'écran, jamais à la racine : la `Modal` se présente alors
 * depuis le contrôleur de l'écran, et le focus revient à la carte quand elle
 * se ferme (tvOS). Les ouvertures sont stables : les rangées et les grilles,
 * mémoïsées, ne se re-rendent pas pour elles.
 */
export function useTVCardActions() {
  const [target, setTarget] = useState<CardSheetTarget | null>(null);
  const openPoster = useCallback((item: MediaItem) => setTarget({ kind: "media", item, variant: "poster" }), []);
  const openLandscape = useCallback((item: MediaItem) => setTarget({ kind: "media", item, variant: "landscape" }), []);
  const openReco = useCallback((item: RecoRowItem) => setTarget({ kind: "reco", item }), []);
  const close = useCallback(() => setTarget(null), []);
  const sheet = target ? <TVCardActionSheet target={target} onClose={close} /> : null;
  return { openPoster, openLandscape, openReco, sheet };
}
