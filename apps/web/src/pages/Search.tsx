import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchItems, useJellyfinClient, useSeerrSearch, useSeerrRequest } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import type { SeerrSearchResult } from "@tentacle/api-client";
import { Navbar } from "../components/Navbar";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  2: { label: "Demandé", color: "bg-yellow-500/20 text-yellow-400" },
  3: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  4: { label: "Partiel", color: "bg-orange-500/20 text-orange-400" },
  5: { label: "Disponible", color: "bg-green-500/20 text-green-400" },
};

type Tab = "library" | "request";

export function Search() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<Tab>("library");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data: libraryResults, isLoading: libLoading } = useSearchItems(debounced);
  const { data: seerrData, isLoading: seerrLoading } = useSeerrSearch(tab === "request" ? debounced : "");
  const requestMutation = useSeerrRequest();

  const seerrResults = (seerrData?.results ?? []).filter((r) => r.mediaType === "movie" || r.mediaType === "tv");
  const isLoading = tab === "library" ? libLoading : seerrLoading;

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />
      <div className="px-12 pt-24 pb-16">
        <h1 className="mb-6 text-3xl font-bold text-white">Rechercher</h1>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Film, série, anime..."
          className="mb-6 w-full rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-tentacle-accent"
          autoFocus
        />

        <div className="mb-6 flex gap-2">
          <TabBtn label="Bibliothèque" active={tab === "library"} onClick={() => setTab("library")} />
          <TabBtn label="Demander du contenu" active={tab === "request"} onClick={() => setTab("request")} />
        </div>

        {isLoading && debounced.length >= 2 && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
          </div>
        )}

        {tab === "library" && !libLoading && (libraryResults?.length ?? 0) > 0 && (
          <LibraryGrid items={libraryResults!} />
        )}
        {tab === "library" && !libLoading && debounced.length >= 2 && libraryResults?.length === 0 && (
          <p className="py-20 text-center text-white/40">Aucun résultat dans votre bibliothèque</p>
        )}

        {tab === "request" && !seerrLoading && seerrResults.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {seerrResults.map((item) => (
              <SeerrCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={requestMutation.mutate} />
            ))}
          </div>
        )}
        {tab === "request" && !seerrLoading && debounced.length >= 2 && seerrResults.length === 0 && (
          <p className="py-20 text-center text-white/40">Aucun résultat</p>
        )}
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-tentacle-accent text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
    }`}>
      {label}
    </button>
  );
}

function LibraryGrid({ items }: { items: MediaItem[] }) {
  const navigate = useNavigate();
  const client = useJellyfinClient();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
        return (
          <div key={item.Id} onClick={() => navigate(`/media/${item.Id}`)}
            className="group cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-transform hover:scale-[1.03]">
            <div className="aspect-[2/3] bg-tentacle-surface">
              <img src={poster} alt={item.Name} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-2.5">
              <p className="text-sm font-medium text-white line-clamp-1">{item.Name}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                {item.ProductionYear && <span>{item.ProductionYear}</span>}
                <span>{item.Type === "Movie" ? "Film" : "Série"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeerrCard({ item, onRequest }: { item: SeerrSearchResult; onRequest: (b: { mediaType: "movie" | "tv"; mediaId: number }) => void }) {
  const title = item.title || item.name || "";
  const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
  const poster = item.posterPath ? `${TMDB_IMG}/w300${item.posterPath}` : null;
  const status = item.mediaInfo?.status;
  const statusInfo = status ? STATUS_LABELS[status] : null;
  const isRequested = status != null && status >= 2;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-tentacle-surface">
      <div className="aspect-[2/3] bg-tentacle-surface">
        {poster ? (
          <img src={poster} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/20">{title}</div>
        )}
      </div>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-3">
          <p className="text-sm font-semibold text-white line-clamp-2">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
            {year && <span>{year}</span>}
            <span className="rounded bg-white/10 px-1.5 py-0.5">{item.mediaType === "movie" ? "Film" : "Série"}</span>
          </div>
          {statusInfo ? (
            <span className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); if (!isRequested) onRequest({ mediaType: item.mediaType as "movie" | "tv", mediaId: item.id }); }}
              className="mt-2 rounded-lg bg-tentacle-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105">
              Demander
            </button>
          )}
        </div>
      </div>
      {status === 5 && (
        <div className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-medium text-white">Disponible</div>
      )}
    </div>
  );
}
