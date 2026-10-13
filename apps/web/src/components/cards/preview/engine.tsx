import { useCallback, useMemo, type ReactNode } from "react";
import {
  TRAILER_PREVIEW_TIMING,
  TrailerPreviewVideo,
  previewSubjectOf,
  previewSubjectOfTitle,
  useTrailerPreview,
  type TrailerPreviewSubject,
} from "../../../trailerPreview";

/**
 * L'ADAPTATEUR du moteur d'aperçu — le seul fichier de la mini-carte qui
 * connaisse l'interface du moteur (`apps/web/src/trailerPreview/`) : délais,
 * demande au serveur, préchargement caché, qualité, son, blocages, réglage.
 * La mini-carte n'en lit que ce qu'elle dessine.
 */

export type PreviewSubject = TrailerPreviewSubject;
export type PreviewMediaType = "movie" | "tv";

/** Ce que la mini-carte lit du moteur. */
export interface PreviewEngine {
  /** La vidéo existe : chargée cachée, montrée, ou dans son fondu de sortie. */
  mount: boolean;
  /** La mini-carte se montre : première image décodée, seconde de survol écoulée. */
  visible: boolean;
  muted: boolean;
  toggleMute: () => void;
  /** L'élément vidéo, plein cadre ; `hold` le garde sur sa première image. */
  renderVideo: (props: { hold: boolean; className: string }) => ReactNode;
}

/** Le fondu de sortie pendant lequel le moteur garde la vidéo montée. */
export const PREVIEW_ENGINE_EXIT_MS = TRAILER_PREVIEW_TIMING.exitMs;

/** Le sujet d'une carte de la bibliothèque (un épisode, une saison valent leur série). */
export const previewSubjectOfItem = previewSubjectOf;
export { previewSubjectOfTitle };

/** Le moteur pour une carte : `hovered` est le survol EFFECTIF (fermetures forcées déjà retirées). */
export function usePreviewEngine(subject: PreviewSubject | null, hovered: boolean): PreviewEngine {
  const handle = useTrailerPreview(subject, hovered);
  const { videoProps, mount, visible, muted, toggleMute } = handle;
  const renderVideo = useCallback(
    ({ hold, className }: { hold: boolean; className: string }) => (
      <TrailerPreviewVideo {...videoProps} hold={hold} className={className} />
    ),
    [videoProps],
  );
  return useMemo(
    () => ({ mount, visible, muted, toggleMute, renderVideo }),
    [mount, visible, muted, toggleMute, renderVideo],
  );
}
