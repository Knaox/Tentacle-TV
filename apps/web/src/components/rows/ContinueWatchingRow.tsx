import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "./MediaRow";

interface ContinueWatchingRowProps {
  title: string;
  items: MediaItem[];
  animDelay?: number;
}

/**
 * Thin wrapper around MediaRow that locks the variant to `episode` (16:9 cards
 * with backdrop image, episode label, and progress overlay) — the layout used
 * for "Reprendre" and "Prochains épisodes" rows.
 *
 * Why a wrapper at all: makes intent explicit at call site (Home.tsx) and
 * provides a single place to evolve the resume row independently later
 * (e.g., add a "Remove from row" gesture without touching MediaRow).
 */
export function ContinueWatchingRow({ title, items, animDelay }: ContinueWatchingRowProps) {
  return (
    <MediaRow
      title={title}
      items={items}
      variant="episode"
      animDelay={animDelay}
    />
  );
}
