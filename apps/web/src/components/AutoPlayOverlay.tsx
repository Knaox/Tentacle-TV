import { UpNextCard } from "./player/UpNextCard";

interface AutoPlayOverlayProps {
  countdown: number;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  /** Optional pre-formatted "S03E08" label. */
  episodeLabel?: string;
  onPlay: () => void;
  onCancel: () => void;
}

/**
 * Thin wrapper preserving the legacy API used by `VideoPlayer.tsx` (HLS web path).
 * The visual treatment now lives in `UpNextCard` so both player engines share
 * the cinema look.
 */
export function AutoPlayOverlay({
  countdown,
  episodeTitle,
  episodeDescription,
  episodeImageUrl,
  episodeLabel,
  onPlay,
  onCancel,
}: AutoPlayOverlayProps) {
  return (
    <UpNextCard
      countdown={countdown}
      episodeTitle={episodeTitle}
      episodeDescription={episodeDescription}
      episodeImageUrl={episodeImageUrl}
      episodeLabel={episodeLabel}
      onPlay={onPlay}
      onDismiss={onCancel}
    />
  );
}
