import { useEffect, useState } from "react";

/**
 * La fenêtre PiP change-t-elle de taille en ce moment ? Vrai au montage — le
 * PiP naît en glissant du lecteur à son coin —, puis à chaque redimensionnement,
 * et faux une fois la taille posée depuis `SETTLE_MS`.
 *
 * Sert à MASQUER le cadre pendant le mouvement : la vidéo est une autre fenêtre
 * (celle de mpv), dont le système garde l'image précédente, plus grande ou plus
 * petite, tant que mpv n'en a pas peint une nouvelle — une à deux images de
 * retard sur le cadre de la page. Filmé à 60 images par seconde : un liseré
 * nettement plus petit, ou plus grand, que l'image, à chaque pas. Sans cadre,
 * ce retard ne se voit plus.
 */

/** Sans changement de taille depuis ce délai, le mouvement est fini. */
const SETTLE_MS = 140;

export function usePipResizing(view: Window | null): boolean {
  const [resizing, setResizing] = useState(true);
  useEffect(() => {
    if (view === null) return;
    let timer = view.setTimeout(() => setResizing(false), SETTLE_MS * 3);
    const onResize = () => {
      setResizing(true);
      view.clearTimeout(timer);
      timer = view.setTimeout(() => setResizing(false), SETTLE_MS);
    };
    view.addEventListener("resize", onResize);
    return () => {
      view.clearTimeout(timer);
      view.removeEventListener("resize", onResize);
    };
  }, [view]);
  return resizing;
}
