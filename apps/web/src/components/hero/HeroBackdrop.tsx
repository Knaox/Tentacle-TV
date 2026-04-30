import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface HeroBackdropProps {
  items: MediaItem[];
  activeIndex: number;
}

const FADE_DURATION_MS = 1000;

/**
 * Fades-between backdrop images for the hero billboard.
 * Stacks all backdrops absolutely and toggles opacity on the active one.
 * Renders the cinema-grade gradient overlays (left + bottom + top vignette).
 */
export function HeroBackdrop({ items, activeIndex }: HeroBackdropProps) {
  const client = useJellyfinClient();

  return (
    <>
      {/* Solid black base — guarantees no flash if all backdrops fail to load */}
      <div className="absolute inset-0 bg-surface-0" />

      {items.map((it, i) => {
        const isEp = it.Type === "Episode";
        const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
        const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
        if (!hasParentBackdrop && !hasOwnBackdrop) return null;

        const backdropId = isEp
          ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
          : it.Id;
        const url = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 85 });

        return (
          <img
            key={it.Id}
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: i === activeIndex ? 1 : 0,
              transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
            }}
            draggable={false}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        );
      })}

      {/* Cinema-grade gradient stack — left fade for text, bottom fade to surface-0 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 35%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 55%, var(--surface-0) 100%)",
        }}
      />
      {/* Subtle top vignette so the transparent topnav has contrast */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)",
        }}
      />

      {/* Tiny grain to avoid banding on solid color zones */}
      <div className="noise-texture absolute inset-0 opacity-[0.08] mix-blend-overlay" aria-hidden />
    </>
  );
}
