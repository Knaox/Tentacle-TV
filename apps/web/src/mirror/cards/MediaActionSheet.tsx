import { useState } from "react";
import { ActionSheet } from "../ui/ActionSheet";
import { cardSheetTitle, type CardSheetTarget } from "./cardSheet";
import { MediaSheetBody } from "./sheet/MediaSheetBody";

/**
 * La feuille de l'appui long d'une carte (`MediaActionSheet` de l'app) — au
 * doigt, ce que le survol est à la souris : les MÊMES actions, dans le même
 * ordre, que le survol web (`CardHoverOverlay`) et que la feuille de l'app,
 * parce qu'elles viennent du même modèle (`resolveCardOverlay`).
 *
 *   bandeau (visuel, affiche, titre) → Lire / Reprendre → Ma liste, favori,
 *   vu → extras (« Plus d'infos » d'une vignette 16:9) → la note.
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
      {held && <MediaSheetBody key={`${held.variant}:${held.item.Id}`} target={held} onClose={onClose} />}
    </ActionSheet>
  );
}
