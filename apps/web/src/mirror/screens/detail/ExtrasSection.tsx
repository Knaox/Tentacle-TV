import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { useJellyfinClient, useSeasons, useSpecialFeatures } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { youtubeId } from "./detailMetrics";

interface RemoteTrailer { Url: string; Name?: string }

interface Tile {
  key: string;
  title: string;
  sub: string;
  thumb: string;
  onPress: () => void;
}

const W = 168;
const H = 95;

/**
 * `MobileExtrasSection` de l'app : film → ses bonus et bandes-annonces ;
 * série → les siens puis une rangée par saison ; épisode → les siens, puis
 * ceux de la série en repli. Chaque rangée s'efface quand elle est vide.
 */
export const ExtrasSection = memo(function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  if (item.Type === "Series") return <SeriesExtras item={item} />;
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers} />
        {seriesItem && <SeriesExtras item={seriesItem} />}
      </>
    );
  }
  return <ExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers} />;
});

function SeriesExtras({ item }: { item: MediaItem }) {
  const { data: seasons } = useSeasons(item.Id);
  return (
    <>
      <ExtrasRow itemId={item.Id} remoteTrailers={item.RemoteTrailers} />
      {seasons?.map((s) => (
        <ExtrasRow key={s.Id} itemId={s.Id} title={s.Name} remoteTrailers={s.RemoteTrailers} />
      ))}
    </>
  );
}

/**
 * `MobileExtrasRow` de l'app : vignettes 168 × 95 (rayon 8, filet
 * `border.subtle`) et leur pastille de lecture de 34 ; titre 13 et type 11
 * dessous. Un bonus local s'ouvre dans le lecteur, une bande-annonce YouTube
 * dans un nouvel onglet (le navigateur externe de l'app).
 */
function ExtrasRow({ itemId, remoteTrailers, title }: { itemId: string; remoteTrailers?: RemoteTrailer[]; title?: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: features } = useSpecialFeatures(itemId);

  const tiles = useMemo(() => {
    const out: Tile[] = [];
    for (const f of (features ?? []) as MediaItem[]) {
      out.push({
        key: `local-${f.Id}`,
        title: f.Name ?? t("extras"),
        sub: f.Type ?? "",
        thumb: client.getImageUrl(f.Id, "Primary", { width: 360, quality: 75 }),
        onPress: () => navigate(`/watch/${f.Id}`),
      });
    }
    for (const r of remoteTrailers ?? []) {
      const id = youtubeId(r.Url);
      if (!id) continue;
      out.push({
        key: `remote-${id}`,
        title: r.Name ?? t("trailer"),
        sub: "YouTube",
        thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        onPress: () => window.open(r.Url, "_blank", "noopener,noreferrer"),
      });
    }
    return out;
  }, [features, remoteTrailers, client, navigate, t]);

  if (tiles.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-3 px-4 text-[18px] font-bold text-content-primary">{title ?? t("extras")}</h3>
      <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={tile.onPress}
            className="mirror-detail-fade-press shrink-0 text-left"
            style={{ width: W, ["--press-opacity" as string]: 0.8 }}
          >
            <span
              className="relative block overflow-hidden rounded-lg border border-line-subtle bg-surface-2"
              style={{ width: W, height: H }}
            >
              <img src={tile.thumb} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40 text-cta-brand-fg">
                  <Play size={16} aria-hidden />
                </span>
              </span>
            </span>
            <span className="mt-1.5 block truncate text-[13px] font-medium text-content-primary">{tile.title}</span>
            {tile.sub ? <span className="block truncate text-[11px] text-content-tertiary">{tile.sub}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
