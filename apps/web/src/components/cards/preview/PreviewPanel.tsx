import type { ReactNode } from "react";
import { PreviewTitle } from "./PreviewChrome";

interface PreviewPanelProps {
  title: string;
  logoUrl: string | null;
  meta: string | null;
  /** Le groupe du survol (étoiles, plateau), monté seulement la mini-carte vue. */
  group: ReactNode;
}

/**
 * Le BANDEAU sous la vidéo de la mini-carte d'une affiche — comme Netflix :
 * le titre (logo, sinon nom), la ligne « année · durée », puis le groupe du
 * survol de la carte (étoiles, plateau), au pied. Fond plein et sombre dans
 * les deux schémas (posé sur média) : il porte les mêmes boutons que la vidéo.
 */
export function PreviewPanel({ title, logoUrl, meta, group }: PreviewPanelProps) {
  return (
    <div className="card-preview-panel">
      <div className="card-preview-chrome min-w-0">
        <PreviewTitle name={title} logoUrl={logoUrl} />
        {meta && <p className="mt-1 truncate text-xs font-medium text-white/65">{meta}</p>}
      </div>
      <div className="card-preview-panel-group">{group}</div>
    </div>
  );
}
