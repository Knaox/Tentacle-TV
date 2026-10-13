import type { CSSProperties, FocusEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveLogoImage, type MediaItem } from "@tentacle-tv/shared";
import { useMountWhile } from "../../../hooks/useMountWhile";
import { PreviewMuteButton, PreviewTitle } from "./PreviewChrome";
import { PREVIEW_EXIT_MS, PREVIEW_MOTION_VARS } from "./previewMotion";
import { previewFromTransform } from "./previewPlacement";
import type { CardPreviewView } from "./usePreviewSession";
import "./cardPreview.css";

interface PreviewFrameProps {
  view: CardPreviewView;
  title: string;
  logoItem: MediaItem | null;
  children: (visible: boolean) => ReactNode;
}

/**
 * Le dessin de la mini-carte : la vidéo plein cadre, le voile du bas, le
 * bouton du son en haut à droite, le titre en bas à gauche et le groupe du
 * survol de la carte en bas à droite.
 *
 * MONTÉE dès que le moteur précharge la vidéo, mais cachée — opacité nulle
 * (jamais `display: none` : une vidéo non rendue ne présente pas sa première
 * image), inerte, hors du flux ; VUE seulement quand le moteur la montre. Le
 * mouvement est décrit dans `cardPreview.css` et `previewMotion.ts`.
 */
export function PreviewFrame({ view, title, logoItem, children }: PreviewFrameProps) {
  const { t } = useTranslation("trailerPreview");
  const client = useJellyfinClient();
  // Le logo ANNONCÉ par la donnée, jamais demandé à l'aveugle (cf. `resolveLogoImage`).
  const logo = logoItem ? resolveLogoImage(logoItem) : null;
  const logoUrl = logo ? client.getImageUrl(logo.id, "Logo", { height: 120, quality: 90, tag: logo.tag }) : null;
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
  } as CSSProperties;

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
      <div className="card-preview-surface">
        {engine.renderVideo({ hold: !settled, className: "card-preview-video" })}
        <div aria-hidden className="card-preview-veil" />
        <div className="card-preview-chrome absolute right-2.5 top-2.5">
          <PreviewMuteButton muted={engine.muted} onToggle={engine.toggleMute} />
        </div>
        {/* Le titre à gauche, le groupe du survol à droite ; trop étroite,
            la mini-carte les empile (le groupe passe dessous, à droite). */}
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-3 pb-2.5">
          <div className="card-preview-chrome min-w-0 max-w-[55%] flex-1 basis-32">
            <PreviewTitle name={title} logoUrl={logoUrl} />
          </div>
          {groupMounted && <div className="ml-auto min-w-0">{children(shown)}</div>}
        </div>
      </div>
    </div>
  );
}
