import { useEffect, useState } from "react";
import { localResourceUrl, useDownloadsRootReady } from "../localFiles";

export interface LocalImage {
  /** Le premier candidat présent, `null` s'il n'y en a aucun. */
  url: string | null;
  /** La sonde a rendu son verdict — avant, ni présent ni absent. */
  settled: boolean;
}

const UNSETTLED: LocalImage = { url: null, settled: false };

/**
 * Le premier visuel du snapshot qui existe VRAIMENT sur le disque, parmi des
 * candidats (`backdrop.jpg`, puis `primary.jpg`…).
 *
 * Un `<img>` posé au hasard afficherait l'icône d'image cassée d'un transfert
 * hérité, et un repli après coup ferait sauter la mise en page — le titre en
 * texte remplacé par son logo sous les yeux. On sonde d'abord (le serveur
 * loopback répond en quelques millisecondes) et la fiche attend le verdict.
 * Le navigateur garde l'image décodée : l'élément qui la reçoit ensuite ne la
 * recharge pas.
 */
export function useFirstLocalImage(itemId: string | undefined, candidates: readonly string[]): LocalImage {
  const rootReady = useDownloadsRootReady();
  const [image, setImage] = useState<LocalImage>(UNSETTLED);
  const key = candidates.join("|");

  useEffect(() => {
    setImage(UNSETTLED);
    if (!itemId || !rootReady) return;
    let cancelled = false;
    const urls = key.split("|").map((name) => localResourceUrl(`meta/${itemId}/${name}`));

    const probe = (index: number): void => {
      if (cancelled) return;
      if (index >= urls.length) {
        setImage({ url: null, settled: true });
        return;
      }
      const candidate = urls[index];
      if (!candidate) {
        probe(index + 1);
        return;
      }
      const element = new Image();
      element.onload = () => {
        if (!cancelled) setImage({ url: candidate, settled: true });
      };
      element.onerror = () => probe(index + 1);
      element.src = candidate;
    };
    probe(0);
    return () => {
      cancelled = true;
    };
  }, [itemId, key, rootReady]);

  return image;
}
