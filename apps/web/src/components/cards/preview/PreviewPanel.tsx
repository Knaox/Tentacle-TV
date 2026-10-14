import { useRef, type CSSProperties, type ReactNode } from "react";
import { PreviewTitle } from "./PreviewChrome";
import { PreviewInfoLines } from "./PreviewInfoLines";
import type { PreviewInfo } from "./previewInfo";
import { PANEL_AIR_ABOVE, PANEL_AIR_BETWEEN, usePanelAir } from "./usePanelAir";

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
  /** La hauteur du bandeau (px) — l'excédent sur son contenu est réparti (`usePanelAir`). */
  height: number;
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
export function PreviewPanel({ title, logoUrl, info, group, height }: PreviewPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Relu quand ce qui s'écrit change (les infos, le logo, la taille), le
  // bandeau complet seulement — groupe du survol monté.
  const air = usePanelAir(
    panelRef,
    `${height}|${logoUrl ?? ""}|${info.genres.length}|${info.episode ? 1 : 0}|${info.progress ? 1 : 0}`,
    group !== null && group !== undefined && group !== false,
  );
  return (
    <div
      ref={panelRef}
      className="card-preview-panel"
      style={{
        "--pv-air-above": `${Math.round(air * PANEL_AIR_ABOVE)}px`,
        "--pv-air-between": `${Math.round(air * PANEL_AIR_BETWEEN)}px`,
      } as CSSProperties}
    >
      <PreviewTitle name={title} logoUrl={logoUrl} />
      {group}
      <PreviewInfoLines info={info} />
    </div>
  );
}
