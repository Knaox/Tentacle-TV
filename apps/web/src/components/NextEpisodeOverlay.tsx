import { UpNextCard } from "./player/UpNextCard";

interface NextEpisodeOverlayProps {
  countdown: number;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  /** Optional pre-formatted "S03E08" label. */
  episodeLabel?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
}

/**
 * Thin wrapper preserving the legacy API used by `DesktopPlayer.tsx` (Tauri MPV path).
 * The visual treatment now lives in `UpNextCard` so both player engines share
 * the cinema look.
 */
export function NextEpisodeOverlay({
  countdown,
  episodeTitle,
  episodeDescription,
  episodeImageUrl,
  episodeLabel,
  onPlayNow,
  onDismiss,
}: NextEpisodeOverlayProps) {
  return (
    <UpNextCard
      countdown={countdown}
      episodeTitle={episodeTitle}
      episodeDescription={episodeDescription}
      episodeImageUrl={episodeImageUrl}
      episodeLabel={episodeLabel}
      onPlay={onPlayNow}
      onDismiss={onDismiss}
    />
  );
}
