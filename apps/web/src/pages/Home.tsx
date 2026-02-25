import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
} from "@tentacle/api-client";
import { Shimmer } from "@tentacle/ui";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCarousel } from "../components/MediaCarousel";

export function Home() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries } = useLibraries();

  return (
    <>
      {/* Hero Banner */}
      {featuredLoading ? (
        <div className="h-[70vh] animate-pulse bg-tentacle-surface" />
      ) : (
        <HeroBanner items={featured ?? []} />
      )}

      {/* Content rows */}
      <div className="space-y-2 pb-20 pt-4">
        {resumeItems && resumeItems.length > 0 && (
          <MediaCarousel title="Reprendre la lecture" items={resumeItems} />
        )}
        {nextUp && nextUp.length > 0 && (
          <MediaCarousel title="Prochains épisodes" items={nextUp} />
        )}
        {watchedItems && watchedItems.length > 0 && (
          <MediaCarousel title="Déjà visionné" items={watchedItems} />
        )}
        {libraries?.map((lib) => (
          <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} />
        ))}
      </div>
    </>
  );
}

function LibraryRow({ libraryId, libraryName }: { libraryId: string; libraryName: string }) {
  const { data: items, isLoading } = useLatestItems(libraryId);

  if (isLoading) {
    return (
      <section className="mb-10 px-4 md:px-12">
        <h2 className="mb-3 text-lg font-semibold text-white/90">Derniers ajouts — {libraryName}</h2>
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} width="170px" height="255px" />
          ))}
        </div>
      </section>
    );
  }

  if (!items || items.length === 0) return null;
  return <MediaCarousel title={`Derniers ajouts — ${libraryName}`} items={items} />;
}
