import { CARD_GLYPH_VIEWBOX, KEPT_OFFLINE_PATH } from "@tentacle-tv/shared";

/**
 * Le glyphe des boutons hors ligne — fiche, ligne d'épisode, plateau de carte.
 *
 * À prendre : la flèche vers un plateau, au trait. Pris (« sur cette
 * machine ») : le glyphe PARTAGÉ de la pastille des cartes — disque plein,
 * flèche évidée —, le même au repos et au survol, sur le bureau et sur le
 * mobile. La couleur (le vert de « prêt ») vient de l'appelant.
 *
 * ⚠️ Jamais de coche pour « pris » : une coche dans un cercle est, au
 * caractère près, le marqueur « vu », et les deux voisinent — dans la rangée
 * d'actions d'une fiche, dans une ligne d'épisode, dans la pastille. Une coche
 * posée sur le plateau (l'ancien « terminé ») s'y lisait encore comme « vu ».
 */

interface DownloadGlyphProps {
  done: boolean;
  className?: string;
  strokeWidth?: number;
}

export function DownloadGlyph({ done, className = "h-5 w-5", strokeWidth = 2 }: DownloadGlyphProps) {
  if (done) {
    return (
      <svg className={className} viewBox={CARD_GLYPH_VIEWBOX} fill="currentColor" aria-hidden>
        <path fillRule="evenodd" clipRule="evenodd" d={KEPT_OFFLINE_PATH} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
