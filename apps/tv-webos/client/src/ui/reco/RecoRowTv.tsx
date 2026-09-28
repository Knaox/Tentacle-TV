import { useCallback, useMemo, type ReactNode } from "react";
import { useSendRecoFeedback, type RecoRowItem } from "@tentacle-tv/api-client";
import { MediaRow } from "../rows/RowTv";
import { recoLibraryItems } from "./recoMediaItem";

interface RecoRowProps {
  title: string;
  items: RecoRowItem[];
  animDelay?: number;
  /** Après le titre, toujours visible (la puce du filtre sur l'accueil). */
  headerTrailing?: ReactNode;
}

/**
 * Une rangée de recommandations, version téléviseur — substituée à
 * `components/reco/RecoRow.tsx`, donc aux rangées `reco:*` de l'accueil.
 *
 * Celle du web avait trois défauts à la télécommande, tous mesurés sur
 * l'accueil. Sa `<section>` portait `tabIndex` — le trou noir que `RowTv`
 * documente déjà. Sa piste n'était pas une piste pour le moteur (pas de
 * `data-tv-piste`) : « gauche » depuis une carte remontait en diagonale
 * jusqu'à la bannière, tout en haut de la page, et l'entrée dans la rangée
 * visait la carte d'en face. Et elle montrait des titres hors bibliothèque,
 * « à la demande », qu'aucun appui n'ouvre sur un téléviseur.
 *
 * Elle devient donc une rangée comme les autres (`RowTv`) : les mêmes cartes,
 * la même piste, le même fenêtrage — et la bibliothèque seule, comme sur
 * l'Apple TV et Android TV. Vidée de ce qui n'est pas sur le serveur, une
 * rangée ne s'affiche pas.
 *
 * Ses cartes gardent pourtant ce qu'une recommandation ajoute au survol :
 * l'appui long offre « Ne plus me proposer », au bout des actions (variante
 * `reco` du modèle partagé).
 */
export function RecoRow({ title, items, animDelay = 0, headerTrailing }: RecoRowProps) {
  const media = useMemo(() => recoLibraryItems(items), [items]);
  const feedback = useSendRecoFeedback();
  const { mutate } = feedback;
  // La carte ne connaît que l'item Jellyfin ; le moteur, lui, parle en clés.
  const onDismissItem = useCallback(
    (itemId: string) => {
      const reco = items.find((entry) => entry.jellyfinItemId === itemId);
      if (reco) mutate({ itemKey: reco.key, action: "dismissed" });
    },
    [items, mutate],
  );
  if (media.length === 0) return null;
  return (
    <MediaRow title={title} items={media} animDelay={animDelay} headerTrailing={headerTrailing} onDismissItem={onDismissItem} />
  );
}
