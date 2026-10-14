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
  /**
   * La mini-carte se montre : rendez-vous passé, et la première image décodée
   * — ou l'image du titre signalée par `reportStillReady` (la bande-annonce est
   * vérifiée par le serveur ; la vidéo la rejoint à `videoReady`).
   */
  visible: boolean;
  /** La première image de la vidéo est décodée : la vidéo peut se montrer (en fondu sur l'image du titre). */
  videoReady: boolean;
  /**
   * L'échelle (≥ 1) qui rogne le letterbox incrusté de la vidéo, à poser en
   * `transform: scale()` sur la VIDÉO seule. 1 jusqu'à la première image (fixée
   * avec `videoReady`), et 1 dans le doute.
   */
  videoCrop: number;
  /**
   * À appeler quand l'image du titre est chargée ET décodée (`img.decode()`),
   * jamais pour une image cassée : la mini-carte peut alors se montrer sans
   * attendre la vidéo. Stable ; sans effet hors d'un aperçu vérifié.
   */
  reportStillReady: () => void;
  /**
   * Un aperçu est EN ROUTE — intention, demande, chargement, prêt à se montrer
   * — et la mini-carte n'est pas encore là. Faux au repos, montrée, et dès que
   * le serveur dit qu'il n'y a rien (pas de bande-annonce, échec).
   */
  pending: boolean;
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
  const { videoProps, mount, visible, videoReady, videoCrop, reportStillReady, muted, toggleMute, phase } = handle;
  const pending = phase === "intent" || phase === "fetching" || phase === "buffering" || phase === "ready";
  const renderVideo = useCallback(
    ({ hold, className }: { hold: boolean; className: string }) => (
      <TrailerPreviewVideo {...videoProps} hold={hold} className={className} />
    ),
    [videoProps],
  );
  return useMemo(
    () => ({ mount, visible, videoReady, videoCrop, reportStillReady, pending, muted, toggleMute, renderVideo }),
    [mount, visible, videoReady, videoCrop, reportStillReady, pending, muted, toggleMute, renderVideo],
  );
}
