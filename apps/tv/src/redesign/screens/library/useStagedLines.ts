import { useEffect, useRef, useState } from "react";
import { createStagingPacer, LINE_STAGING, nextLineCount } from "@tentacle-tv/tv-core";

/**
 * Combien de ses `total` lignes la grille rend : toutes, sauf quand le profil
 * de montage étale le premier montage (`gridStaging`, mode Lite) — la
 * première ligne d'emblée, puis une ligne de plus par image à l'heure (tv-core
 * `nextLineCount`, `createStagingPacer`) : « Films » ne monte plus ses trois
 * écrans d'affiches dans la même image. Une fois la grille montée entière,
 * elle suit ses données sans plus rien retenir. `done` : l'étalement est fini
 * (la page suivante du catalogue n'est demandée qu'ensuite — une grille à
 * moitié montée paraîtrait finir trop tôt).
 */
export function useStagedLines(total: number, staged: boolean): { shown: number; done: boolean } {
  const [shown, setShown] = useState(staged ? LINE_STAGING.initial : Number.POSITIVE_INFINITY);
  const finished = useRef(!staged);
  // Un seul rythme pour tout l'étalement : une image en retard fait attendre la ligne suivante.
  const pacer = useRef(createStagingPacer());
  const done = finished.current || (total > 0 && shown >= total);
  if (done) finished.current = true;
  useEffect(() => {
    if (done || total === 0) return undefined;
    let frame = requestAnimationFrame(function pump(now) {
      if (pacer.current.frame(now)) {
        setShown((current) => nextLineCount(current, total));
        return;
      }
      frame = requestAnimationFrame(pump);
    });
    return () => cancelAnimationFrame(frame);
  }, [done, total, shown]);
  return { shown: done ? total : shown, done };
}
