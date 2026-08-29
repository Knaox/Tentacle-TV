import { useEffect, useState } from "react";
import { sanitizeVtt } from "@tentacle-tv/shared";
import type { SubtitleTrack } from "../components/player/videoPlayer.types";

/**
 * Sous-titres texte du lecteur web : récupère le VTT de la piste SÉLECTIONNÉE,
 * le nettoie (cf. sanitizeVtt) et rend une URL `blob:` à donner au `<track>`.
 *
 * Pourquoi seulement la piste sélectionnée : le navigateur ne charge les cues
 * d'un `<track>` que lorsque son `mode` quitte `disabled` (useNativeMediaTracks
 * n'en laisse qu'un actif). Assainir les autres coûterait une requête par
 * piste pour un fichier que personne n'affichera.
 *
 * L'URL n'est rendue qu'une fois la résolution TERMINÉE — c'est ce qui évite de
 * montrer un instant le fichier brut, balisage compris, pendant que le nôtre
 * arrive. En échec (réseau, page d'erreur servie à la place, format illisible),
 * on rend l'URL d'origine : un sous-titre au balisage visible reste très
 * préférable à pas de sous-titre.
 */
export function useSanitizedSubtitles({
  pistes, selection, src,
}: {
  pistes: SubtitleTrack[];
  selection: number | null;
  src: string;
}): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (selection === null) return;
    const piste = pistes.find((p) => p.index === selection);
    if (!piste) return;

    let annule = false;
    let creee: string | null = null;
    void (async () => {
      let resultat = piste.url;
      try {
        const reponse = await fetch(piste.url);
        if (reponse.ok) {
          const propre = sanitizeVtt(await reponse.text());
          if (propre !== null) {
            creee = URL.createObjectURL(new Blob([propre], { type: "text/vtt" }));
            resultat = creee;
          }
        }
      } catch {
        /* repli sur l'URL d'origine — la piste reste lisible */
      }
      if (annule) {
        // Le blob créé pendant que l'effet se démontait n'atteindra jamais le
        // DOM : le révoquer ici, sinon il fuit jusqu'au rechargement de la page.
        if (creee) URL.revokeObjectURL(creee);
        creee = null;
        return;
      }
      setUrl(resultat);
    })();

    return () => {
      annule = true;
      if (creee) URL.revokeObjectURL(creee);
    };
  }, [pistes, selection, src]);

  return url;
}
