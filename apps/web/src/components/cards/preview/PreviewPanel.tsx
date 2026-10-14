import type { ReactNode } from "react";
import { PreviewTitle } from "./PreviewChrome";
import { PreviewInfoLines } from "./PreviewInfoLines";
import type { PreviewInfo } from "./previewInfo";

interface PreviewPanelProps {
  title: string;
  logoUrl: string | null;
  info: PreviewInfo;
  /**
   * Le groupe du survol (plateau, étoiles), monté seulement la mini-carte vue.
   * Sa coque est transparente à la mise en page : plateau et étoiles prennent
   * leur place dans la rangée du bandeau (`previewPanel.css`).
   */
  group: ReactNode;
}

/**
 * Le BANDEAU sous la vidéo de la mini-carte — affiche comme vignette : les
 * ACTIONS d'abord (« Lire » en tête, « Plus d'infos » au bout), puis le titre
 * (logo, sinon nom) et ses étoiles, puis deux lignes d'infos — l'épisode et sa
 * progression d'un titre commencé, sinon ses faits et ses genres.
 *
 * L'ordre du DOM est celui du sens (le titre, puis ses gestes, puis ses
 * infos) ; l'ordre à l'écran, celui de l'œil — la feuille range. La
 * tabulation, elle, suit l'écran : le plateau, puis les étoiles.
 *
 * Graphite neutre dans les deux schémas (posé sur média) : il porte les mêmes
 * boutons blancs que la vidéo.
 */
export function PreviewPanel({ title, logoUrl, info, group }: PreviewPanelProps) {
  return (
    <div className="card-preview-panel">
      <PreviewTitle name={title} logoUrl={logoUrl} />
      {group}
      <PreviewInfoLines info={info} />
    </div>
  );
}
