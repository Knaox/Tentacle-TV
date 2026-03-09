import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons/HeroIcons";

interface HeroBannerProps {
  items: MediaItem[];
}

const ROTATE_MS = 8000;

export function HeroBanner({ items }: HeroBannerProps) {
  const { t } = useTranslation("common");
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const navigate = useNavigate();
  const client = useJellyfinClient();

  const [resetKey, setResetKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
    setAnimKey((k) => k + 1);
  }, [items.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + items.length) % items.length);
    setAnimKey((k) => k + 1);
  }, [items.length]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (items.length > 1) timerRef.current = setInterval(next, ROTATE_MS);
  }, [next, items.length]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer, resetKey]);

  const goTo = (i: number) => {
    setIndex(i);
    setAnimKey((k) => k + 1);
    setResetKey((k) => k + 1);
  };

  const goPrev = () => { prev(); setResetKey((k) => k + 1); };
  const goNext = () => { next(); setResetKey((k) => k + 1); };

  if (!items.length) return <div className="h-[60vh] sm:h-[65vh] md:h-[70vh]" />;

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
    <div
      className="group/banner relative w-full overflow-hidden h-[60vh] sm:h-[65vh] md:h-[70vh]"
      onMouseEnter={() => clearInterval(timerRef.current)}
      onMouseLeave={() => startTimer()}
    >
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
        const isEp = it.Type === "Episode";
        const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
        const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
        if (!hasParentBackdrop && !hasOwnBackdrop) return null;
        const backdropId = isEp
          ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
          : it.Id;
        const url = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
        return (
          <img
            key={it.Id}
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === index ? 0.65 : 0 }}
            draggable={false}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        );
      })}

      {/* Noise texture overlay */}
      <div className="noise-texture absolute inset-0 opacity-20" />

      {/* Gradient overlays — stronger for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/90 via-tentacle-bg/50 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-12 left-6 right-6 z-10 md:left-12 md:right-1/3 lg:bottom-16 lg:left-16">
        <div key={animKey} style={{ animation: "fadeSlideUp 0.6s ease both" }}>
          {/* Badge + episode label row */}
          {(hasProgress || episodeLabel) && (
            <div className="mb-2 flex items-center gap-3">
              {hasProgress && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                  style={{
                    background: "rgba(139,92,246,0.25)",
                    color: "#C4B5FD",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  {t("common:continueLabel")}
                </span>
              )}
              {episodeLabel && (
                <span className="text-sm font-medium text-white/50">{episodeLabel}</span>
              )}
            </div>
          )}

          {/* Title */}
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="mb-3 h-16 object-contain object-left md:h-20 lg:h-24" draggable={false} />
          ) : (
            <h2
              className="mb-2 text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-5xl lg:text-[3.25rem]"
              style={{ textShadow: `0 4px 40px ${accentColor}80, 0 2px 16px rgba(0,0,0,0.5)` }}
            >
              {displayName}
            </h2>
          )}

          {/* Metadata */}
          <div className="mb-3 flex flex-wrap items-center gap-2.5 text-sm">
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
            <div className="mb-3 flex max-w-xs items-center gap-3">
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

          {/* Overview — 2 lines max */}
          {item.Overview && (
            <p className="mb-4 hidden max-w-xl text-sm leading-relaxed text-white/60 line-clamp-2 sm:block">
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
              <PlayIcon /> {hasProgress ? t("common:resume") : t("common:play")}
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
              {t("common:moreInfo")}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows + pill indicators */}
      {items.length > 1 && (
        <>
          {/* Prev / Next arrows */}
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/70 opacity-0 transition-all duration-300 hover:text-white group-hover/banner:opacity-100"
            style={{
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/70 opacity-0 transition-all duration-300 hover:text-white group-hover/banner:opacity-100"
            style={{
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <ChevronRightIcon />
          </button>

          {/* Pill indicators */}
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
        </>
      )}
    </div>
  );
}
