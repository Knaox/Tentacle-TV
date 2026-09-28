import { useState } from "react";
import { ActionSheet } from "../ui/ActionSheet";
import { cardSheetKey, cardSheetTitle, type CardSheetTarget } from "./cardSheet";
import { MediaSheetBody } from "./sheet/MediaSheetBody";
import { RecoSheetBody } from "./sheet/RecoSheetBody";

/**
 * La feuille de l'appui long d'une carte (`MediaActionSheet` de l'app) — au
 * doigt, ce que le survol est à la souris : les MÊMES actions, dans le même
 * ordre, que le survol web (`CardHoverOverlay`) et que la feuille de l'app,
 * parce qu'elles viennent du même modèle (`resolveCardOverlay`).
 *
 *   bandeau (visuel, affiche, titre) → Lire / Reprendre → Ma liste, favori,
 *   vu → extras (« Plus d'infos » d'une vignette 16:9, « Ne plus me
 *   proposer » d'une recommandation) → la note.
 *
 * UNE feuille pour toutes les cartes de la bibliothèque, recommandations en
 * bibliothèque comprises : seul le corps change, selon ce que la cible sait
 * d'elle-même. Un titre hors bibliothèque a la sienne (`ExternalActionSheet`).
 *
 * Le corps n'est MONTÉ que feuille ouverte : ses bascules lisent les Sets de
 * séries entiers, ses étoiles la liste des notes. La dernière cible reste
 * rendue pendant la sortie — la feuille ne se vide pas en descendant.
 */
export function MediaActionSheet({ target, onClose }: { target: CardSheetTarget | null; onClose: () => void }) {
  const [held, setHeld] = useState(target);
  if (target !== null && target !== held) setHeld(target);

  return (
    <ActionSheet open={target !== null} onClose={onClose} label={held ? cardSheetTitle(held) : undefined}>
      {held?.kind === "reco" && <RecoSheetBody key={cardSheetKey(held)} reco={held.reco} onClose={onClose} />}
      {held?.kind === "media" && <MediaSheetBody key={cardSheetKey(held)} target={held} onClose={onClose} />}
    </ActionSheet>
  );
}
