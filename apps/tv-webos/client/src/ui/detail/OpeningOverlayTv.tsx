import { useEffect, useRef } from "react";
import type { DetailOrigin } from "@/components/detail/detailTransition";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface LayerProps {
  origin: DetailOrigin | null;
  backdropUrl: string | null;
  target: TargetRect | null;
  onDone: () => void;
}

/**
 * L'ouverture de la fiche, rendue à sa plus simple expression.
 *
 * Le calque du client web est une transition d'élément partagé : le visuel de
 * la carte voyage jusqu'à sa place sur la fiche pendant que le décor s'installe
 * derrière lui. C'est une chorégraphie écrite POUR framer-motion, et le shim du
 * téléviseur ne la joue pas — il écarte `initial`, `animate` et `transition`.
 * Ce qui restait n'était pas une version dégradée, c'était une avarie :
 *
 *   - le `<motion.div>` en vol perdait `top`, `left`, `width` et `height` : plus
 *     de dimensions, donc plus de visuel ;
 *   - la copie floutée du décor gardait son `filter: blur(12px)`, qui est un
 *     vrai style DOM, mais perdait l'animation d'opacité qui devait l'effacer.
 *     Elle est posée APRÈS l'image nette et la recouvre : le fond restait donc
 *     flouté à douze pixels pendant toute la vie du calque ;
 *   - `onAnimationComplete` étant appelé au montage par le shim, l'arrêt normal
 *     ne s'exécutait jamais. Seul le garde-fou d'une seconde y mettait fin, et
 *     la disparition était sèche.
 *
 * Une seconde de plein écran flouté, sans mouvement, pour couvrir une
 * navigation qui prend souvent moins. On retire donc le calque.
 *
 * Ce qui le remplace existe déjà et coûte une passe de compositing :
 * `tv.css` anime `#root > *` en opacité sur 180 ms à chaque changement d'écran.
 * C'est la transition légère demandée, et elle n'anime que ce qu'un compositeur
 * sait traiter.
 *
 * `onDone` reste appelé — une fois, au montage. Le parent s'en sert pour
 * relâcher l'origine capturée ; ne pas l'appeler laisserait cette origine en
 * place et la ferait rejouer à l'ouverture suivante.
 */
export function DetailOpenOverlay({ origin, onDone }: LayerProps) {
  const rendered = useRef(false);

  useEffect(() => {
    if (!origin || rendered.current) return;
    rendered.current = true;
    onDone();
  }, [origin, onDone]);

  return null;
}
