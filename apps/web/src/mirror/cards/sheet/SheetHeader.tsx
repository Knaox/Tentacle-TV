import { useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

export interface SheetHeaderProps {
  title: string;
  /** « 2019 · Film », la série d'un épisode… */
  meta?: string | null;
  /** L'affiche 2:3 ; sans elle, l'initiale du titre. */
  posterUrl?: string | null;
  /** Le visuel large, voilé derrière le bandeau. */
  backdropUrl?: string | null;
}

/**
 * Le bandeau de la feuille (`MediaActionSheet` de l'app) : 96 de haut, le
 * visuel voilé derrière, l'affiche 52 × 76, le titre sur deux lignes et sa
 * ligne de faits. Une image absente s'efface sans laisser de trou.
 */
export function SheetHeader({ title, meta, posterUrl, backdropUrl }: SheetHeaderProps) {
  const [posterBroken, setPosterBroken] = useState(false);
  const [backdropBroken, setBackdropBroken] = useState(false);
  return (
    <div className="relative mx-4 mb-4 mt-2 h-24 overflow-hidden rounded-xl border border-line-subtle bg-surface-2">
      {backdropUrl && !backdropBroken && (
        <img
          src={backdropUrl}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setBackdropBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-glass-tint-strong" />
      <div className="relative flex h-full items-center gap-3 p-3">
        <div
          className="relative flex h-[76px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2"
          style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}
        >
          {posterUrl && !posterBroken ? (
            <img
              src={posterUrl}
              alt=""
              decoding="async"
              draggable={false}
              onError={() => setPosterBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden className="text-xl font-extrabold text-content-disabled">
              {title.charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mb-[3px] line-clamp-2 text-base font-bold tracking-[-0.2px] text-content-primary">{title}</h2>
          {meta && <p className="truncate text-[13px] font-medium tracking-[0.2px] text-brand-light">{meta}</p>}
        </div>
      </div>
    </div>
  );
}

type ImageUrl = (id: string, type: "Primary" | "Backdrop", opts: { width: number; quality: number }) => string;
type Translate = (key: string) => string;

const KIND_KEYS: Partial<Record<string, string>> = {
  Movie: "kindMovie",
  Series: "kindSeries",
  Episode: "kindEpisode",
  Season: "kindSeason",
  BoxSet: "kindCollection",
};

/**
 * Le bandeau d'un titre de la bibliothèque. L'affiche d'un épisode montre sa
 * SÉRIE (`showsSeries`) : le bandeau aussi, comme Ma liste et Favoris qui la
 * visent. La vignette 16:9 montre l'épisode : le bandeau le nomme, sa série
 * en dessous.
 */
export function mediaSheetHeader(
  item: MediaItem,
  series: MediaItem | undefined,
  showsSeries: boolean,
  image: ImageUrl,
  tm: Translate,
): SheetHeaderProps {
  const poster = (id: string) => image(id, "Primary", { width: 240, quality: 85 });
  const backdrop = (id: string) => image(id, "Backdrop", { width: 600, quality: 70 });
  const facts = (face: MediaItem) =>
    [face.ProductionYear ?? null, KIND_KEYS[face.Type] ? tm(KIND_KEYS[face.Type] as string) : null].filter(Boolean).join(" · ");

  if (showsSeries && item.SeriesId) {
    return {
      title: series?.Name ?? item.SeriesName ?? item.Name,
      meta: series ? facts(series) : tm("kindSeries"),
      posterUrl: poster(item.SeriesId),
      backdropUrl: backdrop(item.SeriesId),
    };
  }
  if (item.Type === "Episode") {
    const code = item.IndexNumber != null
      ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
      : "";
    return {
      title: `${code}${item.Name}`,
      meta: item.SeriesName ?? null,
      posterUrl: poster(item.SeriesId ?? item.Id),
      // La vignette de l'épisode lui-même, derrière le voile.
      backdropUrl: image(item.Id, "Primary", { width: 600, quality: 70 }),
    };
  }
  return { title: item.Name, meta: facts(item), posterUrl: poster(item.Id), backdropUrl: backdrop(item.Id) };
}
