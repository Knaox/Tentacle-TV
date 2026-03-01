import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

export function SearchLibrary({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();

  if (items.length === 0) {
    return <p className="py-20 text-center text-white/40">{t("common:noResultsLibrary")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
        return (
          <div
            key={item.Id}
            onClick={() => navigate(`/media/${item.Id}`)}
            className="group cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-transform hover:scale-[1.03]"
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
          </div>
        );
      })}
    </div>
  );
}
