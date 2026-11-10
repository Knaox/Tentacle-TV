import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";

/**
 * Le glyphe des boutons hors ligne — fiche, ligne d'épisode, plateau de carte.
 *
 * À prendre : la flèche vers un plateau, au trait. Pris (« sur cette
 * machine ») : la MÊME flèche, pleine — celle de la pastille des cartes
 * (`KeptGlyph`), la même au repos et au survol. Phosphor depuis la refonte de
 * nov. 2026. La couleur (le vert de « prêt ») vient de l'appelant.
 *
 * ⚠️ Jamais de coche pour « pris » : une coche dans un cercle est, au
 * caractère près, le marqueur « vu », et les deux voisinent — dans la rangée
 * d'actions d'une fiche, dans une ligne d'épisode, dans la pastille. Une coche
 * posée sur le plateau (l'ancien « terminé ») s'y lisait encore comme « vu ».
 */

interface DownloadGlyphProps {
  done: boolean;
  className?: string;
  /** L'épaisseur du trait d'avant : à partir de 2,4, la graisse forte. */
  strokeWidth?: number;
}

export function DownloadGlyph({ done, className = "h-5 w-5", strokeWidth = 2 }: DownloadGlyphProps) {
  const weight = done ? "fill" : strokeWidth >= 2.4 ? "bold" : "regular";
  return <DownloadSimpleIcon className={className} weight={weight} aria-hidden />;
}
