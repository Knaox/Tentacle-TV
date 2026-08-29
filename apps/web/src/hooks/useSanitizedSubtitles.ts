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
  tracks, selection, src,
}: {
  tracks: SubtitleTrack[];
  selection: number | null;
  src: string;
}): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (selection === null) return;
    const track = tracks.find((p) => p.index === selection);
    if (!track) return;

    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      let result = track.url;
      try {
        const response = await fetch(track.url);
        if (response.ok) {
          const clean = sanitizeVtt(await response.text());
          if (clean !== null) {
            created = URL.createObjectURL(new Blob([clean], { type: "text/vtt" }));
            result = created;
          }
        }
      } catch {
        /* repli sur l'URL d'origine — la piste reste lisible */
      }
      if (cancelled) {
        // Le blob créé pendant que l'effet se démontait n'atteindra jamais le
        // DOM : le révoquer ici, sinon il fuit jusqu'au rechargement de la page.
        if (created) URL.revokeObjectURL(created);
        created = null;
        return;
      }
      setUrl(result);
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [tracks, selection, src]);

  return url;
}
