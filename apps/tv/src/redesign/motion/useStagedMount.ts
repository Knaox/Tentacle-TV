import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { TV_MOTION } from "@tentacle-tv/theme";
import { MOTION_ENABLED } from "./motion";

/**
 * Le montage ÉCHELONNÉ de ce qui ne se voit pas encore — les sections d'une
 * page, sous son premier écran : rien tant que la page ENTRE (attente puis
 * entrée de son en-tête, préréglage `page`), puis un rang de plus à chaque
 * image. Le montage d'une rangée (des dizaines de vues créées sur le fil
 * principal, ~20 ms au simulateur) ne retient plus le départ de la page ni
 * son entrée, et n'en prend qu'une image à la fois. Sans mouvement : dès
 * l'image suivante, toujours un rang par image.
 *
 * Rend le nombre de rangs libérés : 0 au montage, `ranks` au bout. Ce qui
 * arrive ensuite (des données plus lentes) se monte à son arrivée.
 */
export function useStagedMount(ranks: number): number {
  const reduced = useReducedMotion();
  const [released, setReleased] = useState(0);
  useEffect(() => {
    let count = 0;
    let frame: number | null = null;
    const step = () => {
      count += 1;
      setReleased(count);
      frame = count < ranks ? requestAnimationFrame(step) : null;
    };
    const wait = MOTION_ENABLED && !reduced ? TV_MOTION.page.enterDelayMs + TV_MOTION.page.enterMs : 0;
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, wait);
    return () => {
      clearTimeout(timer);
      if (frame !== null) cancelAnimationFrame(frame);
    };
    // Une fois, au montage de la page : l'échelonnement ne recommence pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return released;
}
