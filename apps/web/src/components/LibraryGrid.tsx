import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraryItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface LibraryGridProps {
  libraryId: string;
  libraryName: string;
}

const SORT_OPTIONS = [
  { value: "DateCreated,Descending", labelKey: "sortDateDesc" },
  { value: "SortName,Ascending", labelKey: "sortTitleAsc" },
  { value: "SortName,Descending", labelKey: "sortTitleDesc" },
  { value: "ProductionYear,Descending", labelKey: "sortYearDesc" },
  { value: "ProductionYear,Ascending", labelKey: "sortYearAsc" },
  { value: "CommunityRating,Descending", labelKey: "sortRatingDesc" },
] as const;

export function LibraryGrid({ libraryId, libraryName }: LibraryGridProps) {
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("SortName,Ascending");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const [sortBy, sortOrder] = sort.split(",");

  const { data: items, isLoading } = useLibraryItems(libraryId, {
    search: debounced,
    limit: 50,
    sortBy,
    sortOrder,
  });

  return (
    <div>
      {/* Search + Sort bar */}
      <div className="mb-6 flex flex-col gap-3 px-4 sm:flex-row sm:items-center md:px-12">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("common:searchInLibrary", { name: libraryName })}
          className="w-full max-w-md rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-tentacle-bg text-white">
              {t(`common:${o.labelKey}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="px-4 md:px-12">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="py-20 text-center text-white/40">
            {debounced.length >= 2 ? t("common:noResults") : t("common:emptyLibrary")}
          </p>
        ) : (
          <MediaGrid items={items} />
        )}
      </div>
    </div>
  );
}

function MediaGrid({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {items.map((item, i) => (
        <GridCard key={item.Id} item={item} index={i} navigate={navigate} client={client} t={t} />
      ))}
    </div>
  );
}

function GridCard({ item, index, navigate, client, t }: {
  item: MediaItem; index: number;
  navigate: ReturnType<typeof useNavigate>;
  client: ReturnType<typeof useJellyfinClient>;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
  const progress = item.UserData?.PlayedPercentage;

  return (
    <div
      onClick={() => navigate(`/media/${item.Id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-transform duration-300 hover:scale-[1.03]"
      style={{ animation: `fadeSlideUp 0.5s ease both`, animationDelay: `${index * 40}ms` }}
    >
      <div className="aspect-[2/3] bg-tentacle-surface">
        <img
          src={poster} alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
        />
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium text-white line-clamp-1">{item.Name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/50">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
        </div>
      </div>
      {progress != null && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
