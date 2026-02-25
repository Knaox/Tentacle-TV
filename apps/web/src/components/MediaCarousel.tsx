import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
}

export function MediaCarousel({ title, items }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  if (!items.length) return null;

  return (
    <section className="relative mb-10">
      <h2 className="mb-3 px-4 md:px-12 text-lg font-semibold tracking-wide text-white/90">
        {title}
      </h2>

      <div className="group/carousel relative">
        <ScrollButton direction="left" visible={canScrollLeft} onClick={() => scroll("left")} />

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-2 overflow-x-auto scroll-smooth px-4 md:px-12 pb-4 scrollbar-hide"
        >
          {items.map((item) => (
            <CarouselCard key={item.Id} item={item} />
          ))}
        </div>

        <ScrollButton direction="right" visible={canScrollRight} onClick={() => scroll("right")} />
      </div>
    </section>
  );
}

function ScrollButton({ direction, visible, onClick }: { direction: "left" | "right"; visible: boolean; onClick: () => void }) {
  const isLeft = direction === "left";
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClick}
          className={`absolute top-0 z-20 hidden h-full w-12 items-center justify-center group-hover/carousel:flex ${
            isLeft ? "left-0 bg-gradient-to-r from-black/80 to-transparent" : "right-0 bg-gradient-to-l from-black/80 to-transparent"
          }`}
        >
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={isLeft ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function CarouselCard({ item }: { item: MediaItem }) {
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const progress = item.UserData?.PlayedPercentage;
  const watched = item.UserData?.Played === true;
  const isEpisode = item.Type === "Episode";

  const imageUrl = isEpisode && item.SeriesId
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
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group/card relative flex-shrink-0 cursor-pointer"
      style={{ width: 170 }}
      onClick={handleClick}
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-tentacle-surface">
        <img
          src={imageUrl}
          alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end rounded-lg bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
        <div className="p-3">
          <p className="text-sm font-semibold text-white line-clamp-2">
            {isEpisode ? item.SeriesName : item.Name}
          </p>
          {isEpisode && (
            <p className="mt-0.5 text-xs text-white/50">
              S{item.ParentIndexNumber}E{item.IndexNumber}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
            {year && <span>{year}</span>}
            {rating && (
              <span className="flex items-center gap-0.5">
                <StarIcon /> {rating}
              </span>
            )}
          </div>
          <button className="pointer-events-auto mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-tentacle-bg transition-transform hover:scale-110">
            <PlayIcon />
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
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg bg-white/10">
          <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
    </motion.div>
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
    <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3 w-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
