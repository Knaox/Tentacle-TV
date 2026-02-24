import { useState } from "react";
import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
} from "@tentacle/api-client";
import { Shimmer } from "@tentacle/ui";
import { Sidebar } from "../components/Sidebar";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCarousel } from "../components/MediaCarousel";
import { LibraryGrid } from "../components/LibraryGrid";
import { DiscoverGrid } from "../components/DiscoverGrid";
import { MyRequestsList } from "../components/MyRequestsList";
import { DownloadList } from "../components/DownloadList";
import { SupportPanel } from "../components/SupportPanel";
import { GlobalSearch } from "../components/GlobalSearch";

export function Home() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries } = useLibraries();
  const [activeTab, setActiveTab] = useState("home");

  const isHome = activeTab === "home";
  const libraryMatch = activeTab.startsWith("lib-") ? activeTab.slice(4) : null;
  const libraryName = libraryMatch
    ? libraries?.find((l) => l.Id === libraryMatch)?.Name ?? ""
    : "";

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Sidebar activeKey={activeTab} onChange={setActiveTab} />

      {/* Main content — offset for sidebar */}
      <div className="pl-16">
        {/* Search bar — fixed top right */}
        <div className="fixed right-6 top-4 z-30">
          <GlobalSearch />
        </div>

        {/* Hero Banner — only on Accueil */}
        {isHome && (
          <>
            {featuredLoading ? (
              <div className="h-[70vh] animate-pulse bg-tentacle-surface" />
            ) : (
              <HeroBanner items={featured ?? []} />
            )}
          </>
        )}

        {/* Tab content */}
        <div className={`pb-20 ${isHome ? "" : "pt-8"}`}>
          {isHome && <HomeContent resumeItems={resumeItems} nextUp={nextUp} watchedItems={watchedItems} libraries={libraries} />}
          {libraryMatch && <LibraryGrid libraryId={libraryMatch} libraryName={libraryName} />}
          {activeTab === "discover" && <div className="px-12 pt-4"><DiscoverGrid /></div>}
          {activeTab === "requests" && <div className="pt-4"><MyRequestsList /></div>}
          {activeTab === "downloads" && <div className="px-12 pt-4"><DownloadList /></div>}
          {activeTab === "support" && <div className="pt-4"><SupportPanel /></div>}
        </div>
      </div>
    </div>
  );
}

function HomeContent({ resumeItems, nextUp, watchedItems, libraries }: {
  resumeItems: any[] | undefined;
  nextUp: any[] | undefined;
  watchedItems: any[] | undefined;
  libraries: any[] | undefined;
}) {
  return (
    <div className="space-y-2 pt-4">
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
