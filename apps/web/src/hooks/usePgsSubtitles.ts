import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { PgsRenderer } from "libpgs";
import workerUrl from "libpgs/dist/libpgs.worker.js?url";

const DBG = "[Tentacle:PGS]";

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** URL du `.sup` servi par Jellyfin. */
  supUrl: string;
  /**
   * Décalage entre l'horloge du `<video>` et le temps média — le même que
   * `effectiveOffsetRef` du lecteur. En lecture directe il vaut zéro ; sur un
   * flux à PTS absolus (`CopyTimestamps`) il rattrape le décalage du conteneur.
   */
  timeOffsetRef: MutableRefObject<number>;
  /** Chargement ou décodage impossible : le serveur doit reprendre la main. */
  onEchec: () => void;
}

/**
 * Décode et affiche une piste PGS côté client.
 *
 * Le fichier est récupéré ICI plutôt que par `loadFromUrl` : libpgs avale ses
 * erreurs réseau, et sans réponse vérifiée un `.sup` manquant se traduirait par
 * un silence — exactement le mode d'échec qu'on refuse ailleurs. On lit donc
 * l'`ArrayBuffer` nous-mêmes, et le moindre défaut déclenche le repli.
 */
export function usePgsSubtitles({
  videoRef, canvasRef, supUrl, timeOffsetRef, onEchec,
}: Options): void {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let renderer: PgsRenderer | null = null;
    let annule = false;

    const syncOffset = () => {
      if (renderer && renderer.timeOffset !== timeOffsetRef.current) {
        renderer.timeOffset = timeOffsetRef.current;
      }
    };

    (async () => {
      try {
        // Chargé à la demande : la très grande majorité des lectures n'a aucune
        // piste image, et le décodeur (avec ses polyfills) pèse plus de 100 ko.
        const [{ PgsRenderer }, res] = await Promise.all([
          import("libpgs"),
          fetch(supUrl, { credentials: "same-origin" }),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (annule) return;
        if (buffer.byteLength === 0) throw new Error("fichier .sup vide");

        renderer = new PgsRenderer({
          video, canvas, workerUrl,
          aspectRatio: "contain", // le <video> est en object-fit: contain
          timeOffset: timeOffsetRef.current,
        });
        renderer.loadFromBuffer(buffer);
        video.addEventListener("timeupdate", syncOffset);
      } catch (err) {
        if (annule) return;
        console.warn(DBG, "rendu client impossible — repli sur l'incrustation serveur", err);
        onEchec();
      }
    })();

    return () => {
      annule = true;
      video.removeEventListener("timeupdate", syncOffset);
      renderer?.dispose();
      renderer = null;
    };
    // `onEchec` et les refs sont stables ; seule la piste doit relancer le rendu.
  }, [supUrl]); // eslint-disable-line react-hooks/exhaustive-deps
}
