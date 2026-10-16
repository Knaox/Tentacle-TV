/**
 * L'APERÇU DE BANDE-ANNONCE AU SURVOL — le moteur : quand demander, quand
 * montrer, la lecture, le son, les réglages. La mini-carte qui le montre vit
 * dans `components/cards/preview/` et n'importe QUE cet index.
 *
 * Usage, dans une carte :
 *
 *   const preview = useTrailerPreview(previewSubjectOf(item), hovered);
 *   {preview.mount && (
 *     <MiniCard visible={preview.visible}>              // opacité, jamais display:none
 *       <TrailerPreviewVideo {...preview.videoProps} hold={agrandissementEnCours} className="…" />
 *       <MuteButton muted={preview.muted} onClick={preview.toggleMute} />
 *     </MiniCard>
 *   )}
 *
 * `mount` reste vrai `TRAILER_PREVIEW_TIMING.exitMs` après que `visible` est
 * retombé : la sortie de la mini-carte s'y cale. Le module est remplacé dans le
 * client LG (webOS) par une version inerte (`apps/tv-webos`).
 */
export type { TrailerPreviewPhase, TrailerPreviewSubject } from "@tentacle-tv/shared";
export { TRAILER_PREVIEW_TIMING } from "@tentacle-tv/shared";
export type { TrailerPreviewHandle, TrailerPreviewStream, TrailerPreviewVideoProps } from "./previewTypes";
export { previewSubjectOf, previewSubjectOfTitle } from "./previewSubject";
export { useTrailerPreview } from "./useTrailerPreview";
export { TrailerPreviewVideo } from "./TrailerPreviewVideo";
export { useTrailerPreviewDelay, useTrailerPreviewMuted, useTrailerPreviewsSetting } from "./previewSettings";
export { trackPreviewWarm } from "./previewWarm";
