import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../../rows/MediaRow";
import { ProgressBar } from "../../ui/ProgressBar";
import { Pressable } from "../../ui/Pressable";
import { useCardWidth } from "../../useMirrorLayout";

interface ListEntry {
  id: string;
  name: string;
  year?: number;
  played: boolean;
  progress: number;
}

/**
 * `MyListRow` de l'app : « À regarder », dédoublonnée, « Voir tout » vers Ma
 * liste. Ses cartes sont plus sobres que `MediaCard` (ni note, ni code
 * d'épisode) : affiche 2:3 rayon 12, coche blanche 22 des vus, progression à
 * 6 du bas ; titre 13, année 10. Appui simple sans échelle, comme l'app.
 */
export const MyListRow = memo(function MyListRow({ items, onSeeAll, onItemPress, onItemLongPress }: {
  items: MediaItem[];
  onSeeAll: () => void;
  onItemPress: (id: string) => void;
  onItemLongPress: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const out: ListEntry[] = [];
    for (const item of items) {
      if (seen.has(item.Id)) continue;
      seen.add(item.Id);
      out.push({
        id: item.Id,
        name: item.Name,
        year: item.ProductionYear ?? undefined,
        played: item.UserData?.Played === true,
        progress: item.UserData?.PlayedPercentage ?? 0,
      });
    }
    return out;
  }, [items]);

  return (
    <MediaRow
      title={t("toWatch")}
      data={entries}
      keyOf={(e) => e.id}
      onSeeAll={onSeeAll}
      renderItem={(e) => <ListCard entry={e} onPress={onItemPress} onLongPress={onItemLongPress} />}
    />
  );
});

function ListCard({ entry, onPress, onLongPress }: {
  entry: ListEntry;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const client = useJellyfinClient();
  const width = useCardWidth();
  const [broken, setBroken] = useState(false);
  const hasProgress = entry.progress > 0 && entry.progress < 100;
  return (
    <Pressable
      scale={1}
      onPress={() => onPress(entry.id)}
      onLongPress={() => onLongPress(entry.id)}
      style={{ width }}
      aria-label={entry.name}
    >
      <div className="relative overflow-hidden rounded-xl" style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}>
        <div className="aspect-[2/3] bg-surface-2">
          {!broken && (
            <img
              src={client.getImageUrl(entry.id, "Primary", { width: 300, quality: 80 })}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        {entry.played && (
          <span
            className="absolute right-[7px] top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cta-primary-bg text-cta-primary-fg"
            style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.35)" }}
          >
            <Check size={11} strokeWidth={3} aria-hidden />
          </span>
        )}
        {hasProgress && <ProgressBar progress={entry.progress / 100} className="absolute inset-x-1.5 bottom-1.5" />}
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold tracking-[-0.1px] text-content-primary">{entry.name}</p>
      {entry.year ? <p className="mt-0.5 text-[10px] font-medium text-content-tertiary">{entry.year}</p> : null}
    </Pressable>
  );
}
