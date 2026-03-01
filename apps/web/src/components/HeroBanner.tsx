import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";

interface HeroBannerProps {
  items: MediaItem[];
}

const ROTATE_MS = 6000;

export function HeroBanner({ items }: HeroBannerProps) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const navigate = useNavigate();
  const client = useJellyfinClient();

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
    setAnimKey((k) => k + 1);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, ROTATE_MS);
    return () => clearInterval(timer);
  }, [next, items.length]);

  const goTo = (i: number) => {
    setIndex(i);
    setAnimKey((k) => k + 1);
  };

  if (!items.length) return <div className="h-[420px]" />;

  const item = items[index];
  const isEpisode = item.Type === "Episode";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const logoUrl = item.ImageTags?.Logo
    ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 })
    : isEpisode && item.SeriesId
      ? client.getImageUrl(item.SeriesId, "Logo", { width: 500, quality: 90 })
      : null;
  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const episodeLabel = isEpisode
    ? `S${item.ParentIndexNumber ?? "?"}E${item.IndexNumber ?? "?"} - ${item.Name}`
    : null;
  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const accentColor = "#8B5CF6"; // default accent

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: 420 }}>
      {/* Animated radial gradient backgrounds */}
      {items.map((it, i) => (
        <div
          key={it.Id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: i === index ? 1 : 0,
            background: `radial-gradient(ellipse at 30% 50%, ${accentColor}55, transparent 70%),
                         radial-gradient(ellipse at 80% 20%, ${accentColor}33, transparent 60%),
                         linear-gradient(135deg, #0a0a14, #12121f)`,
          }}
        />
      ))}

      {/* Backdrop image with crossfade */}
      {items.map((it, i) => {
        const backdropId = it.Type === "Episode" && it.SeriesId ? it.SeriesId : it.Id;
        const url = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
        return (
          <img
            key={it.Id}
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === index ? 0.3 : 0 }}
            draggable={false}
          />
        );
      })}

      {/* Noise texture overlay */}
      <div className="noise-texture absolute inset-0 opacity-20" />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-10 left-4 right-4 z-10 md:left-10 md:right-1/3">
        <div key={animKey} style={{ animation: "fadeSlideUp 0.6s ease both" }}>
          {/* Badge */}
          {hasProgress && (
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "rgba(139,92,246,0.25)",
                color: "#C4B5FD",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              Continuer
            </span>
          )}

          {/* Title */}
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="mb-4 h-16 object-contain object-left" draggable={false} />
          ) : (
            <h2
              className="mb-3 text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-5xl"
              style={{ textShadow: `0 4px 30px ${accentColor}60` }}
            >
              {displayName}
            </h2>
          )}
          {episodeLabel && (
            <p className="mb-2 text-sm font-medium text-white/60">{episodeLabel}</p>
          )}

          {/* Metadata */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            {item.ProductionYear && <span className="text-white/50">{item.ProductionYear}</span>}
            {item.CommunityRating && (
              <span className="flex items-center gap-1 text-amber-400">
                <StarIcon /> {item.CommunityRating.toFixed(1)}
              </span>
            )}
            {item.OfficialRating && (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs text-white/60">
                {item.OfficialRating}
              </span>
            )}
            {item.Genres?.slice(0, 2).map((g) => (
              <span
                key={g}
                className="rounded-md px-2 py-0.5 text-xs"
                style={{
                  background: `${accentColor}33`,
                  color: `${accentColor}cc`,
                  border: `1px solid ${accentColor}44`,
                }}
              >
                {g}
              </span>
            ))}
            {runtime && <span className="text-white/40">{runtime}</span>}
          </div>

          {/* Progress bar */}
          {hasProgress && (
            <div className="mb-5 flex max-w-xs items-center gap-3">
              <div className="h-1 flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                    boxShadow: "0 0 12px rgba(139,92,246,0.4)",
                  }}
                />
              </div>
              <span className="text-xs text-white/40">{Math.round(progress)}%</span>
            </div>
          )}

          {/* Overview */}
          {item.Overview && (
            <p className="mb-5 hidden max-w-xl text-sm leading-relaxed text-white/60 line-clamp-3 sm:block">
              {item.Overview}
            </p>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/watch/${item.Id}`)}
              className="hero-btn-primary flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                boxShadow: "0 8px 30px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <PlayIcon /> {hasProgress ? "Reprendre" : "Lecture"}
            </button>
            <button
              onClick={() => navigate(`/media/${isEpisode && item.SeriesId ? item.SeriesId : item.Id}`)}
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.14]"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Plus d'infos
            </button>
          </div>
        </div>
      </div>

      {/* Pill indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-8 z-10 flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === index ? 28 : 8,
                height: 8,
                background:
                  i === index ? "linear-gradient(90deg, #8B5CF6, #A78BFA)" : "rgba(255,255,255,0.2)",
                boxShadow: i === index ? "0 0 12px rgba(139,92,246,0.5)" : "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
