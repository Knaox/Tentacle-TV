import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
  /** Extra delay (ms) added to entry animations for cascade sequencing */
  animDelay?: number;
}

export function MediaCarousel({ title, items, animDelay = 0 }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visible, setVisible] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -400 : 400, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  // IntersectionObserver for entry animations
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!items.length) return null;

  return (
    <section
      ref={rowRef}
      className="group/row relative mb-10"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `all 0.6s ease ${animDelay}ms`,
      }}
    >
      {/* Title with "Tout voir" on hover */}
      <div className="mb-4 flex items-center gap-2 px-4 md:px-8">
        <h2 className="text-lg font-bold tracking-tight text-white/90">{title}</h2>
        <span className="-translate-x-2 flex items-center gap-0.5 text-xs font-medium text-purple-400 opacity-0 transition-all duration-300 group-hover/row:translate-x-0 group-hover/row:opacity-100">
          Tout voir
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      <div className="relative">
        {/* Left fade + button */}
        {canScrollLeft && (
          <>
            <div
              className="pointer-events-none absolute bottom-8 left-0 top-0 z-10 w-16"
              style={{ background: "linear-gradient(to right, #08081280, transparent)" }}
            />
            <button
              onClick={() => scroll("left")}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 opacity-0 transition-all duration-300 group-hover/row:opacity-100"
              style={{
                background: "rgba(139,92,246,0.6)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        )}

        {/* Right fade + button */}
        {canScrollRight && (
          <>
            <div
              className="pointer-events-none absolute bottom-8 right-0 top-0 z-10 w-16"
              style={{ background: "linear-gradient(to left, #08081280, transparent)" }}
            />
            <button
              onClick={() => scroll("right")}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 opacity-0 transition-all duration-300 group-hover/row:opacity-100"
              style={{
                background: "rgba(139,92,246,0.6)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 overflow-x-auto scroll-smooth px-4 pb-8 pt-4 scrollbar-hide md:px-8"
        >
          {visible && items.map((item, i) => <CarouselCard key={item.Id} item={item} index={i} />)}
        </div>
      </div>
    </section>
  );
}

function CarouselCard({ item, index }: { item: MediaItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const progress = item.UserData?.PlayedPercentage;
  const watched = item.UserData?.Played === true;
  const isEpisode = item.Type === "Episode";
  const genre = item.Genres?.[0];

  const imageUrl =
    isEpisode && item.SeriesId
      ? client.getImageUrl(item.SeriesId, "Primary", { height: 450, quality: 90 })
      : client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });

  const handleClick = () => {
    if (item.Type === "Episode") {
      navigate(`/watch/${item.Id}`);
      return;
    }
    navigate(`/media/${item.Id}`);
  };

  return (
    <div
      className="group/card relative flex-shrink-0 cursor-pointer"
      style={{
        width: 165,
        animation: `fadeSlideUp 0.5s ease both`,
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Poster */}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          aspectRatio: "2/3",
          transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.35s ease",
          transform: hovered ? "scale(1.06) translateY(-8px)" : "scale(1)",
          boxShadow: hovered
            ? "0 20px 40px rgba(139,92,246,0.3), 0 0 60px rgba(139,92,246,0.15)"
            : "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <img
          src={imageUrl}
          alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex flex-col justify-end"
          style={{
            background: hovered
              ? "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%)",
            transition: "all 0.35s ease",
          }}
        >
          <div
            className="p-3"
            style={{
              transform: hovered ? "translateY(0)" : "translateY(10px)",
              opacity: hovered ? 1 : 0,
              transition: "all 0.3s ease 0.05s",
            }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {year && <span className="text-xs text-white/60">{year}</span>}
              {rating && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400">
                  <StarIcon /> {rating}
                </span>
              )}
              {genre && (
                <span
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{ background: "rgba(139,92,246,0.3)", color: "#c4b5fd" }}
                >
                  {genre}
                </span>
              )}
            </div>
            {isEpisode && (
              <p className="text-xs text-white/40">
                S{item.ParentIndexNumber}E{item.IndexNumber}
              </p>
            )}
            {/* Play button */}
            <button
              className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(139,92,246,0.85)",
                backdropFilter: "blur(8px)",
                opacity: hovered ? 1 : 0,
                transition: "all 0.3s ease 0.1s",
              }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/watch/${item.Id}`);
              }}
            >
              <PlayIcon /> Lecture
            </button>
          </div>
        </div>

        {/* Watched badge */}
        {watched && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tentacle-accent shadow">
            <CheckIcon />
          </div>
        )}

        {/* Progress bar */}
        {!watched && progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div
              className="h-full rounded-r-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                boxShadow: hovered ? "0 0 12px rgba(139,92,246,0.6)" : "0 0 8px rgba(139,92,246,0.4)",
                transition: "box-shadow 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* Title below card */}
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-medium text-white/90">
          {isEpisode ? item.SeriesName : item.Name}
        </h3>
        <p className="mt-0.5 text-xs text-white/35">
          {year && <>{year}</>}
          {year && genre && " · "}
          {genre}
        </p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
