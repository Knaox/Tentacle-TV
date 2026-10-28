/**
 * Octave — « Garder hors ligne » / « Retirer de cet appareil » dans le menu
 * « Plus » d'un titre (`TrackMenu`). Le menu est déjà le geste réfléchi : le
 * retrait s'y fait d'un clic, comme le reste. Rien sans le droit (`keepRules.ts`).
 * Gardé d'ici, le titre est RETENU pour lui-même (collection `track`) : la tenue à
 * jour ne le retire pas quand une playlist le perd.
 */

import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { canKeepTrack, trackPhase, holdKey } from "@tentacle-tv/offline-core/music";
import { useOfflineSurface } from "./offlineSurfaceContext";
import { useKeepGestures } from "./useKeepGestures";
import { useKeptTrack } from "./useKeptMusic";

interface KeepMenuItemProps {
  track: MusicTrack;
  className: string;
  /** Referme le menu. */
  onDone: () => void;
}

export function KeepMenuItem({ track, className, onDone }: KeepMenuItemProps) {
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <KeepMenuItemFor track={track} className={className} onDone={onDone} canKeep={canKeepTrack(track, surface)} />;
}

function KeepMenuItemFor({ track, className, onDone, canKeep }: KeepMenuItemProps & { canKeep: boolean }) {
  const { t } = useTranslation("musicOffline");
  const kept = useKeptTrack(track.key);
  const gestures = useKeepGestures();
  const phase = trackPhase(kept);
  if (phase !== "none" && kept) {
    return (
      <button type="button" role="menuitem" className={className} onClick={() => (onDone(), void gestures.remove([kept], holdKey(track.key)))}>
        {phase === "failed" ? <AlertCircle className="h-4 w-4 text-status-error-fg" aria-hidden /> : <DownloadGlyph done className="h-4 w-4 text-status-success-fg" />}
        {t("remove")}
      </button>
    );
  }
  if (!canKeep) return null;
  return (
    <button type="button" role="menuitem" className={className} onClick={() => (onDone(), void gestures.keep([track], { key: holdKey(track.key), kind: "track", title: track.title, subtitle: null, trackKeys: [track.key] }))}>
      <DownloadGlyph done={false} className="h-4 w-4 text-content-tertiary" />
      {t("keep")}
    </button>
  );
}
