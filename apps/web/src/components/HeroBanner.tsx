import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";

interface HeroBannerProps {
  items: MediaItem[];
}

const ROTATE_MS = 8000;

export function HeroBanner({ items }: HeroBannerProps) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const client = useJellyfinClient();

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, ROTATE_MS);
    return () => clearInterval(timer);
  }, [next, items.length]);

  if (!items.length) return <div className="h-[70vh]" />;

  const item = items[index];
  const backdropUrl = client.getImageUrl(item.Id, "Backdrop", { width: 1920, quality: 80 });
  const logoUrl = item.ImageTags?.Logo
    ? client.getImageUrl(item.Id, "Logo", { width: 500, quality: 90 })
    : null;

  const runtime = item.RunTimeTicks
    ? `${Math.floor(item.RunTimeTicks / 600_000_000)}h ${Math.floor((item.RunTimeTicks % 600_000_000) / 10_000_000)}min`
    : null;

  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      {/* Backdrop image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={item.Id}
          src={backdropUrl}
          alt=""
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-tentacle-bg via-tentacle-bg/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-tentacle-bg/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-16 left-4 right-4 z-10 md:left-12 md:right-1/3">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.Id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={item.Name} className="mb-4 h-16 object-contain object-left" draggable={false} />
            ) : (
              <h2 className="mb-4 text-2xl font-bold tracking-tight text-white drop-shadow-lg md:text-4xl">
                {item.Name}
              </h2>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-white/70 md:gap-3">
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.OfficialRating && (
                <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">{item.OfficialRating}</span>
              )}
              {item.CommunityRating && <span>{item.CommunityRating.toFixed(1)} / 10</span>}
              {runtime && <span>{runtime}</span>}
              {item.Genres?.slice(0, 3).map((g) => (
                <span key={g} className="text-white/50">{g}</span>
              ))}
            </div>

            {item.Overview && (
              <p className="mb-5 hidden max-w-xl text-sm leading-relaxed text-white/70 line-clamp-3 sm:block">
                {item.Overview}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/watch/${item.Id}`)}
                className="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-tentacle-bg transition-transform hover:scale-105 md:px-6 md:py-2.5 md:text-base"
              >
                <PlayIcon /> Lecture
              </button>
              <button
                onClick={() => navigate(`/media/${item.Id}`)}
                className="flex items-center gap-2 rounded-lg bg-white/15 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 md:px-6 md:py-2.5 md:text-base">
                Plus d'infos
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-6 left-4 z-10 flex gap-2 md:left-12">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? "w-8 bg-white" : "w-4 bg-white/30"
              }`}
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
