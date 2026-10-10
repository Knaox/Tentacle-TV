import { useMemo } from "react";
import { createPortal } from "react-dom";
import { usePictureInPicture } from "./pictureInPictureContext";
import { PipControls } from "./PipControls";
import type { PipLoading } from "./PipLoadingView";

type PipControlsProps = Parameters<typeof PipControls>[0];

/**
 * Les contrôles du PiP, rendus par le lecteur dans la fenêtre PiP — seulement
 * pendant le PiP, et une fois sa fenêtre ouverte. Le lecteur reste maître de
 * ses gestes : le portail ne fait que les porter dans l'autre fenêtre.
 */
export function PlayerPipPortal(props: PipControlsProps) {
  const pip = usePictureInPicture();
  if (!pip.active || pip.container === null) return null;
  return createPortal(<PipControls {...props} />, pip.container);
}

const nothing = (): void => undefined;

/** Le titre du PiP : « Série · S01E02 — Épisode », ou le titre seul. */
export function pipTitle(title?: string | null, subtitle?: string | null): string | undefined {
  if (!title) return subtitle ?? undefined;
  return subtitle ? `${title} · ${subtitle}` : title;
}

/** Le titre du PiP, et sa vue de chargement tant que le lecteur charge (`null` ensuite). */
export function usePipLoading(loading: boolean, posterUrl?: string, title?: string | null, subtitle?: string | null) {
  const fullTitle = pipTitle(title, subtitle);
  const pipLoading = useMemo(() => (loading ? { posterUrl, title: fullTitle } : null), [loading, posterUrl, fullTitle]);
  return { fullTitle, pipLoading };
}

/**
 * Le PiP pendant les phases où le lecteur n'a pas encore ses contrôles — page
 * d'attente, préparation de mpv : la vue de chargement, et la sortie.
 */
export function PipLoadingPortal({ posterUrl, title }: PipLoading) {
  const loading = useMemo(() => ({ posterUrl, title }), [posterUrl, title]);
  return (
    <PlayerPipPortal
      paused={false} position={0} duration={0} title={title ?? ""}
      onTogglePause={nothing} onSkip={nothing} loading={loading}
    />
  );
}
