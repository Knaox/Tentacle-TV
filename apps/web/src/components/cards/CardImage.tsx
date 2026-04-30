import { useState } from "react";

interface CardImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Fallback rendered when the image fails to load. */
  fallback?: React.ReactNode;
}

/**
 * Lazy-loaded image with shimmer skeleton + graceful error fallback.
 * Used by both PosterCard and EpisodeCard.
 */
export function CardImage({ src, alt, className, fallback }: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      {!loaded && !errored && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 240ms ease-out",
          }}
        />
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-white/30">
          {fallback ?? <FallbackIcon />}
        </div>
      )}
    </div>
  );
}

function FallbackIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}
