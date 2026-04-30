import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
  useWatchlist,
  useHomeWebSocket,
  useJellyfinClient,
} from "@tentacle-tv/api-client";
import { HeroBillboard } from "../components/hero/HeroBillboard";
import { MediaRow } from "../components/rows/MediaRow";
import { ContinueWatchingRow } from "../components/rows/ContinueWatchingRow";
import { PageTransition } from "../components/PageTransition";

export function Home() {
  const client = useJellyfinClient();
  const wsToken = client.getAccessToken() || localStorage.getItem("tentacle_token");
  useHomeWebSocket({ token: wsToken });
  const { t } = useTranslation("common");
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchlist } = useWatchlist();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries } = useLibraries();

  // Hero: prioritize resume items (quick resume), fallback to featured
  const heroItems = resumeItems && resumeItems.length > 0
    ? resumeItems.slice(0, 5)
    : featured ?? [];
  const heroLoading = featuredLoading && !resumeItems;

  return (
    <PageTransition>
      {/* Hero billboard — escapes AppLayout top padding so the transparent
          TopNav floats over the backdrop (Netflix pattern). */}
      <div className="-mt-[56px] md:-mt-[68px]">
        {heroLoading ? (
          <div className="skeleton-shimmer h-[80vh] w-full md:h-[88vh] lg:h-[92vh]" />
        ) : (
          <HeroBillboard items={heroItems} />
        )}
      </div>

      {/* Content rows — relative z-index above hero fade */}
      <div className="relative z-10 -mt-12 space-y-0 pb-24 md:-mt-16">
        {resumeItems && resumeItems.length > 0 && (
          <ContinueWatchingRow
            title={t("common:resumeWatching")}
            items={resumeItems}
            animDelay={150}
          />
        )}
        {nextUp && nextUp.length > 0 && (
          <ContinueWatchingRow
            title={t("common:nextEpisodes")}
            items={nextUp}
            animDelay={250}
          />
        )}
        {watchlist && watchlist.length > 0 && (
          <MediaRow
            title={t("common:myList")}
            items={watchlist}
            animDelay={350}
            href="/watchlist"
          />
        )}
        {watchedItems && watchedItems.length > 0 && (
          <MediaRow
            title={t("common:alreadyWatched")}
            items={watchedItems}
            animDelay={450}
          />
        )}
        {libraries?.map((lib, i) => (
          <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} delayIndex={i} />
        ))}
      </div>
    </PageTransition>
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
      <section className="row-gutter mb-10">
        <h2 className="mb-3 text-base font-semibold text-white/90 md:text-lg">
          {t("common:latestAdditions", { name: libraryName })}
        </h2>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-shimmer aspect-[2/3] w-32 flex-shrink-0 rounded-md sm:w-44 lg:w-52"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <MediaRow
      title={t("common:latestAdditions", { name: libraryName })}
      items={items}
      animDelay={550 + delayIndex * 80}
      href={`/library/${libraryId}`}
    />
  );
}
