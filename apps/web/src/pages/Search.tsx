import { useState, useEffect } from "react";
import { useSearchItems, useSeerrSearch, useSeerrRequest } from "@tentacle/api-client";
import { Navbar } from "../components/Navbar";
import { SearchLibrary } from "../components/SearchLibrary";
import { SeerrCard } from "../components/SeerrCard";
import { DiscoverGrid } from "../components/DiscoverGrid";
import { RequestList } from "../components/RequestList";
import { DownloadList } from "../components/DownloadList";

type Tab = "library" | "discover" | "request" | "requests" | "downloads";

const TABS: { key: Tab; label: string }[] = [
  { key: "library", label: "Bibliothèque" },
  { key: "discover", label: "Découvrir" },
  { key: "request", label: "Demander" },
  { key: "requests", label: "Demandes" },
  { key: "downloads", label: "Téléchargements" },
];

export function Search() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<Tab>("library");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const showSearch = tab === "library" || tab === "request";

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />
      <div className="px-12 pt-24 pb-16">
        <h1 className="mb-6 text-3xl font-bold text-white">Rechercher</h1>

        {/* Tab bar */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-tentacle-accent text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search input for search-based tabs */}
        {showSearch && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Film, série, anime..."
            className="mb-6 w-full rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-tentacle-accent"
            autoFocus
          />
        )}

        {/* Tab content */}
        {tab === "library" && <LibraryTab query={debounced} />}
        {tab === "request" && <RequestTab query={debounced} />}
        {tab === "discover" && <DiscoverGrid />}
        {tab === "requests" && <RequestList />}
        {tab === "downloads" && <DownloadList />}
      </div>
    </div>
  );
}

function LibraryTab({ query }: { query: string }) {
  const { data, isLoading } = useSearchItems(query);
  if (isLoading && query.length >= 2) return <Spinner />;
  if (!data || data.length === 0) {
    if (query.length >= 2) return <p className="py-20 text-center text-white/40">Aucun résultat dans votre bibliothèque</p>;
    return <p className="py-20 text-center text-white/40">Tapez pour rechercher dans votre bibliothèque</p>;
  }
  return <SearchLibrary items={data} />;
}

function RequestTab({ query }: { query: string }) {
  const { data, isLoading } = useSeerrSearch(query);
  const requestMutation = useSeerrRequest();
  const results = (data?.results ?? []).filter((r) => r.mediaType === "movie" || r.mediaType === "tv");

  if (isLoading && query.length >= 2) return <Spinner />;
  if (results.length === 0) {
    if (query.length >= 2) return <p className="py-20 text-center text-white/40">Aucun résultat</p>;
    return <p className="py-20 text-center text-white/40">Recherchez un film ou une série à demander</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {results.map((item) => (
        <SeerrCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={requestMutation.mutate} />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}
