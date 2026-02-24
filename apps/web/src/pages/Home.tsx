import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useFeaturedItems,
} from "@tentacle/api-client";
import { Shimmer } from "@tentacle/ui";
import { Navbar } from "../components/Navbar";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCarousel } from "../components/MediaCarousel";

export function Home() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: libraries } = useLibraries();

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />

      {/* Hero Banner */}
      {featuredLoading ? (
        <div className="h-[70vh] animate-pulse bg-tentacle-surface" />
      ) : (
        <HeroBanner items={featured ?? []} />
      )}

      {/* Carousels */}
      <div className="-mt-16 relative z-10 space-y-2 pb-20">
        {/* Reprendre la lecture */}
        {resumeItems && resumeItems.length > 0 && (
          <MediaCarousel title="Reprendre la lecture" items={resumeItems} />
        )}

        {/* Prochains épisodes */}
        {nextUp && nextUp.length > 0 && (
          <MediaCarousel title="Prochains épisodes" items={nextUp} />
        )}

        {/* Derniers ajouts par bibliothèque */}
        {libraries?.map((lib) => (
          <LibraryRow key={lib.Id} libraryId={lib.Id} libraryName={lib.Name} />
        ))}
      </div>
    </div>
  );
}

function LibraryRow({ libraryId, libraryName }: { libraryId: string; libraryName: string }) {
  const { data: items, isLoading } = useLatestItems(libraryId);

  if (isLoading) {
    return (
      <section className="mb-10 px-12">
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
