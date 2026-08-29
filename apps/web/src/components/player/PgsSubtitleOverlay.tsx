import { useRef, type MutableRefObject, type RefObject } from "react";
import { usePgsSubtitles } from "../../hooks/usePgsSubtitles";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** URL du `.sup`. Le composant n'est monté que lorsqu'une piste PGS est active. */
  supUrl: string;
  timeOffsetRef: MutableRefObject<number>;
  onFailure: () => void;
}

/**
 * Sous-titres image (PGS) dessinés sur un canvas superposé à la vidéo, à la
 * place d'une incrustation serveur qui obligerait à ré-encoder toute l'image.
 *
 * Le composant n'est monté que quand une piste image est réellement
 * sélectionnée (cf. `VideoPlayer`) : rien ne tourne ni n'est composé le reste
 * du temps — un canvas plein écran inutile coûterait une passe de compositing
 * par image décodée.
 *
 * `z-[5]` : au-dessus de la vidéo, sous le spinner de chargement (`z-10`) et
 * sous les contrôles. Même ordre d'empilement que les overlays mobile et TV,
 * qui restent eux aussi sous l'OSD.
 */
export function PgsSubtitleOverlay({ videoRef, supUrl, timeOffsetRef, onFailure }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePgsSubtitles({ videoRef, canvasRef, supUrl, timeOffsetRef, onFailure });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
    />
  );
}
