import type { CSSProperties, FocusEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMountWhile } from "../../../hooks/useMountWhile";
import { PreviewMuteButton } from "./PreviewChrome";
import { PreviewMedia } from "./PreviewMedia";
import { PreviewPanel } from "./PreviewPanel";
import { usePreviewArt } from "./usePreviewArt";
import { PREVIEW_EXIT_MS, PREVIEW_MOTION_VARS } from "./previewMotion";
import { previewFromTransform } from "./previewPlacement";
import type { CardPreviewView } from "./usePreviewSession";
import "./cardPreview.css";
import "./previewSurface.css";
import "./previewPanel.css";
import "./previewActions.css";

interface PreviewFrameProps {
  view: CardPreviewView;
  title: string;
  artItem: MediaItem | null;
  /** La fiche à lire quand la carte n'a pas d'item (une recommandation de la bibliothèque). */
  detailItemId: string | null;
  backdropUrl: string | null;
  /** L'année que donne une carte sans item (« 2016 ») ; sinon elle se lit sur l'item ou sa fiche. */
  meta: string | null;
  children: (visible: boolean) => ReactNode;
}

/**
 * Le dessin de la mini-carte — le même pour une affiche et une vignette : la
 * VIDÉO en 16:9 en haut (`PreviewMedia` : l'image du titre, puis la vidéo en
 * fondu), nue, avec le seul bouton du son ; puis le BANDEAU (`PreviewPanel`) :
 * les actions, le titre et ses étoiles, les infos. Quand la place ne laisse
 * pas de bandeau (aucune taille actuelle), le même bandeau se pose sur un
 * voile, au pied de la vidéo.
 *
 * MONTÉE dès que le moteur précharge la vidéo, mais cachée — opacité nulle
 * (jamais `display: none` : une vidéo non rendue ne présente pas sa première
 * image), inerte, hors du flux ; VUE seulement quand le moteur la montre. Le
 * mouvement de la boîte est décrit dans `cardPreview.css` et
 * `previewMotion.ts`, son dessin dans `previewSurface.css`, `previewPanel.css`
 * et `previewActions.css`.
 */
export function PreviewFrame({ view, title, artItem, detailItemId, backdropUrl, meta, children }: PreviewFrameProps) {
  const { t } = useTranslation("trailerPreview");
  const art = usePreviewArt(artItem, detailItemId, backdropUrl, meta);
  const withPanel = view.placement.videoHeight < view.placement.height;
  const { placement, shown, settled, engine, portalRef, focusInsideRef } = view;
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
      // Les touches ne remontent pas à la carte (Entrée ouvrirait sa fiche).
      onKeyDown={(e) => e.stopPropagation()}
      onFocus={() => {
        focusInsideRef.current = true;
      }}
      onBlur={onBlur}
    >
      <div className="card-preview-surface" data-layout={withPanel ? "panel" : "overlay"}>
        <div className="card-preview-stage" style={{ "--pv-video-crop": engine.videoCrop } as CSSProperties}>
          <PreviewMedia engine={engine} shown={shown} settled={settled} backdropUrl={art.backdropUrl} />
          <div aria-hidden className="card-preview-veil" />
          <PreviewMuteButton muted={engine.muted} onToggle={engine.toggleMute} />
        </div>
        <PreviewPanel title={title} logoUrl={art.logoUrl} info={art.info} group={group} height={placement.height - placement.videoHeight} />
      </div>
    </div>
  );
}
