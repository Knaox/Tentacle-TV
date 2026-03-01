import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraryItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface LibraryGridProps {
  libraryId: string;
  libraryName: string;
}

export function LibraryGrid({ libraryId, libraryName }: LibraryGridProps) {
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data: items, isLoading } = useLibraryItems(libraryId, {
    search: debounced,
    limit: 50,
  });

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6 px-4 md:px-12">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("common:searchInLibrary", { name: libraryName })}
          className="w-full max-w-md rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
        />
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
      {items.map((item) => {
        const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
        const progress = item.UserData?.PlayedPercentage;

        return (
          <div
            key={item.Id}
            onClick={() => navigate(`/media/${item.Id}`)}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-transform hover:scale-[1.03]"
          >
            <div className="aspect-[2/3] bg-tentacle-surface">
              <img src={poster} alt={item.Name} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-2.5">
              <p className="text-sm font-medium text-white line-clamp-1">{item.Name}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                {item.ProductionYear && <span>{item.ProductionYear}</span>}
                <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
              </div>
            </div>
            {/* Progress bar */}
            {progress != null && progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
