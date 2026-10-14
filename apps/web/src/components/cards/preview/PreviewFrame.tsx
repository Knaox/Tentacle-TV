import type { CSSProperties, FocusEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMountWhile } from "../../../hooks/useMountWhile";
import { PreviewMuteButton, PreviewTitle } from "./PreviewChrome";
import { PreviewMedia } from "./PreviewMedia";
import { PreviewPanel } from "./PreviewPanel";
import { usePreviewArt } from "./usePreviewArt";
import { PREVIEW_EXIT_MS, PREVIEW_MOTION_VARS } from "./previewMotion";
import { previewFromTransform } from "./previewPlacement";
import type { CardPreviewView } from "./usePreviewSession";
import "./cardPreview.css";

interface PreviewFrameProps {
  view: CardPreviewView;
  title: string;
  artItem: MediaItem | null;
  /** La fiche à lire quand la carte n'a pas d'item (une recommandation de la bibliothèque). */
  detailItemId: string | null;
  backdropUrl: string | null;
  /** La ligne « année · durée » donnée par la carte (sinon lue sur l'item). */
  meta: string | null;
  children: (visible: boolean) => ReactNode;
}

/**
 * Le dessin de la mini-carte : l'image du titre puis la vidéo (`PreviewMedia`)
 * et le bouton du son en haut à droite. Puis, selon le gabarit :
 *
 *   • affiche — un BANDEAU plein sous la vidéo (`PreviewPanel`) : titre,
 *     année · durée, étoiles et plateau ;
 *   • vignette 16:9 — la vidéo seule, le titre et le groupe du survol posés
 *     dessus, sur un voile en bas.
 *
 * MONTÉE dès que le moteur précharge la vidéo, mais cachée — opacité nulle
 * (jamais `display: none` : une vidéo non rendue ne présente pas sa première
 * image), inerte, hors du flux ; VUE seulement quand le moteur la montre. Le
 * mouvement est décrit dans `cardPreview.css` et `previewMotion.ts`.
 */
export function PreviewFrame({ view, title, artItem, detailItemId, backdropUrl, meta, children }: PreviewFrameProps) {
  const { t } = useTranslation("trailerPreview");
  const art = usePreviewArt(artItem, detailItemId, backdropUrl);
  const withPanel = view.placement.videoHeight < view.placement.height;
  const { placement, shown, settled, engine, portalRef, focusInsideRef, close } = view;
  // Le survol de la mini-carte n'existe que vue — et le temps de sa sortie :
  // le préchargement caché ne s'abonne à rien.
  const groupMounted = useMountWhile(shown, PREVIEW_EXIT_MS);
  const style = {
    ...PREVIEW_MOTION_VARS,
    left: placement.left,
    top: placement.top,
    width: placement.width,
    height: placement.height,
    "--preview-from": previewFromTransform(placement.from),
    "--preview-video-h": `${placement.videoHeight}px`,
  } as CSSProperties;
  const group = groupMounted ? children(shown) : null;

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusInsideRef.current = false;
  };

  return (
    <div
      ref={portalRef}
      className="card-preview"
      data-card-preview
      data-shown={shown}
      role="group"
      aria-label={title ? t("previewLabel", { title }) : t("previewLabelUntitled")}
      aria-hidden={!shown}
      inert={!shown}
      style={style}
      // La molette ne fait pas défiler une mini-carte : elle la ferme net, et
      // le geste suivant revient à la rangée ou à la page.
      onWheel={() => close("wheel")}
      // Les touches ne remontent pas à la carte (Entrée ouvrirait sa fiche).
      onKeyDown={(e) => e.stopPropagation()}
      onFocus={() => {
        focusInsideRef.current = true;
      }}
      onBlur={onBlur}
    >
      <div className="card-preview-surface" data-layout={withPanel ? "panel" : "overlay"}>
        <div className="card-preview-stage">
          <PreviewMedia engine={engine} shown={shown} settled={settled} backdropUrl={art.backdropUrl} />
          <div aria-hidden className="card-preview-veil" />
          <div className="card-preview-chrome absolute right-2.5 top-2.5">
            <PreviewMuteButton muted={engine.muted} onToggle={engine.toggleMute} />
          </div>
          {!withPanel && (
            // Vignette : le titre à gauche, le groupe à droite, sur la vidéo ;
            // trop étroite, elle les empile (le groupe passe dessous, à droite).
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-3 pb-2.5">
              <div className="card-preview-chrome min-w-0 max-w-[55%] flex-1 basis-32">
                <PreviewTitle name={title} logoUrl={art.logoUrl} />
              </div>
              {group && <div className="ml-auto min-w-0">{group}</div>}
            </div>
          )}
        </div>
        {withPanel && <PreviewPanel title={title} logoUrl={art.logoUrl} meta={meta ?? art.meta} group={group} />}
      </div>
    </div>
  );
}
