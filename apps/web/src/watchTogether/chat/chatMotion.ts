/**
 * D'où le chat entre, et où il sort : le panneau et sa bulle naissent à 96 % (ils sortent l'un
 * de l'autre, en bas à droite), la feuille d'une fenêtre étroite monte de 32 px, un aperçu de
 * message arrive du bord droit, la bulle s'enfonce sous le doigt.
 *
 * Mouvement réduit : RIEN ne bouge — ils fondent sur place. Le fondu reste (il dit ce qui
 * s'ouvre), l'échelle et le glissement s'en vont ; le reste de l'interface le faisait déjà
 * (`floatingMotion`), le chat non : son panneau grandissait encore de 4 % à l'ouverture
 * (mesuré sous `prefers-reduced-motion`, lot « rf2 »).
 */
export interface ChatEntrance {
  /** L'échelle de départ (et de sortie) du panneau et de la bulle. */
  scale: number;
  /** Le décalage de départ (et de sortie) de la feuille, en pixels. */
  sheetY: number;
  /** Le décalage de départ d'un aperçu de message, en pixels. */
  toastX: number;
  /** L'échelle de la bulle sous la pression. */
  tapScale: number;
}

export function chatEntrance(reducedMotion: boolean): ChatEntrance {
  return reducedMotion ? { scale: 1, sheetY: 0, toastX: 0, tapScale: 1 } : { scale: 0.96, sheetY: 32, toastX: 24, tapScale: 0.97 };
}
