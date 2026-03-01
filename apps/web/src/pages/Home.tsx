import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
} from "@tentacle-tv/api-client";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCarousel } from "../components/MediaCarousel";

export function Home() {
  const { t } = useTranslation("common");
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries } = useLibraries();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Hero: prioritize resume items (quick resume), fallback to featured
  const heroItems = resumeItems && resumeItems.length > 0
    ? resumeItems.slice(0, 5)
    : featured ?? [];
  const heroLoading = featuredLoading && !resumeItems;

  return (
    <>
      {/* Hero Banner */}
      <div
        className="px-4 pt-4 md:px-8"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease 0.2s",
        }}
      >
        {heroLoading ? (
          <div className="skeleton-shimmer h-[480px] rounded-2xl" />
        ) : (
          <HeroBanner items={heroItems} />
        )}
      </div>

      {/* Content rows */}
      <div className="space-y-2 pb-20 pt-6">
        {resumeItems && resumeItems.length > 0 && (
          <MediaCarousel title={t("common:resumeWatching")} items={resumeItems} animDelay={350} />
        )}
        {nextUp && nextUp.length > 0 && (
          <MediaCarousel title={t("common:nextEpisodes")} items={nextUp} animDelay={450} />
        )}
        {watchedItems && watchedItems.length > 0 && (
          <MediaCarousel title={t("common:alreadyWatched")} items={watchedItems} animDelay={550} />
        )}
        {libraries?.map((lib, i) => (
          <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} delayIndex={i} />
        ))}
      </div>
    </>
  );
}

function LibraryRow({
  libraryId,
  libraryName,
  delayIndex,
}: {
  libraryId: string;
  libraryName: string;
  delayIndex: number;
}) {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useLatestItems(libraryId);

  if (isLoading) {
    return (
      <section className="mb-10 px-4 md:px-8">
        <h2 className="mb-3 text-lg font-semibold text-white/90">
          {t("common:latestAdditions", { name: libraryName })}
        </h2>
        <div className="flex gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-shimmer flex-shrink-0 rounded-xl"
              style={{ width: 165, aspectRatio: "2/3" }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <MediaCarousel
      title={t("common:latestAdditions", { name: libraryName })}
      items={items}
      animDelay={650 + delayIndex * 100}
    />
  );
}
