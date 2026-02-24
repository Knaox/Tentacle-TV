import { useState, useMemo } from "react";
import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
} from "@tentacle/api-client";
import { Shimmer } from "@tentacle/ui";
import { Navbar } from "../components/Navbar";
import { HeroBanner } from "../components/HeroBanner";
import { MediaCarousel } from "../components/MediaCarousel";
import { TabBar } from "../components/TabBar";
import type { Tab } from "../components/TabBar";
import { LibraryGrid } from "../components/LibraryGrid";
import { DiscoverGrid } from "../components/DiscoverGrid";
import { RequestSearch } from "../components/RequestSearch";
import { MyRequestsList } from "../components/MyRequestsList";
import { DownloadList } from "../components/DownloadList";
import { SupportPanel } from "../components/SupportPanel";

export function Home() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries } = useLibraries();
  const [activeTab, setActiveTab] = useState("home");

  // Build dynamic tabs from Jellyfin libraries
  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [{ key: "home", label: "Accueil" }];
    if (libraries) {
      for (const lib of libraries) {
        list.push({ key: `lib-${lib.Id}`, label: lib.Name });
      }
    }
    list.push(
      { key: "discover", label: "Découvrir" },
      { key: "request", label: "Faire une demande" },
      { key: "requests", label: "Demandes en cours" },
      { key: "downloads", label: "Téléchargements" },
      { key: "support", label: "Aide" },
    );
    return list;
  }, [libraries]);

  const isHome = activeTab === "home";
  const libraryMatch = activeTab.startsWith("lib-") ? activeTab.slice(4) : null;
  const libraryName = libraryMatch
    ? libraries?.find((l) => l.Id === libraryMatch)?.Name ?? ""
    : "";

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />

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

      {/* Tab bar */}
      <div className={isHome ? "-mt-16 relative z-10" : "pt-20"}>
        <TabBar tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="pb-20">
        {isHome && <HomeContent resumeItems={resumeItems} nextUp={nextUp} watchedItems={watchedItems} libraries={libraries} />}
        {libraryMatch && <LibraryGrid libraryId={libraryMatch} libraryName={libraryName} />}
        {activeTab === "discover" && <div className="px-12 pt-4"><DiscoverGrid /></div>}
        {activeTab === "request" && <div className="pt-4"><RequestSearch /></div>}
        {activeTab === "requests" && <div className="pt-4"><MyRequestsList /></div>}
        {activeTab === "downloads" && <div className="px-12 pt-4"><DownloadList /></div>}
        {activeTab === "support" && <div className="pt-4"><SupportPanel /></div>}
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
