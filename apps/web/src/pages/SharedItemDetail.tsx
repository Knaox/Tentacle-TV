import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSharedItem, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import { DetailHero } from "../components/detail/DetailHero";
import { CastRow } from "../components/CastRow";
import { TrailerModal } from "../components/detail/TrailerModal";
import { parseYouTubeId } from "../components/detail/youtube";
import { StarIcon } from "../components/icons/HeroIcons";

/**
 * Fiche détail PUBLIQUE d'un média de la liste partagée (/share/:token/:itemId).
 * Résumé + bandes-annonces uniquement — pas de saisons, pas de lecture du
 * contenu (réservée aux comptes connectés via la vraie fiche /media/:id).
 */
export function SharedItemDetail() {
  const { token, itemId } = useParams<{ token: string; itemId: string }>();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item, isLoading, isError } = useSharedItem(token, itemId);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerIndex, setTrailerIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-0">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-white" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-0 px-4 text-center">
        <p className="text-lg font-semibold text-white">{t("shareLinkNotFound")}</p>
        <Link to={token ? `/share/${token}` : "/"} className="mt-3 text-sm font-medium text-[var(--brand-light)] hover:underline">
          {t("backHome", "Retour")}
        </Link>
      </div>
    );
  }

  const backdrop = client.getImageUrl(item.ParentBackdropItemId ?? item.Id, "Backdrop", { width: 1920, quality: 85 });
  const poster = client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 });
  const trailers = (item.RemoteTrailers ?? []).filter((tr) => parseYouTubeId(tr.Url));
  const runtime = formatDuration(item.RunTimeTicks);

  return (
    <div className="min-h-dvh bg-surface-0">
      <DetailHero backdropUrl={backdrop} />

      <div className="relative z-10 -mt-40 px-4 pb-16 md:px-12">
        <div className="flex gap-4 md:gap-8">
          {poster && (
            <img src={poster} alt={item.Name} className="w-28 flex-shrink-0 rounded-md shadow-2xl ring-1 ring-white/10 md:w-48" draggable={false} />
          )}
          <div className="flex-1 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{t("readOnlyList")}</p>
            <h1 className="mt-1 text-2xl font-bold text-white line-clamp-2 md:text-4xl">{item.Name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
              {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
              {item.CommunityRating != null && (
                <span className="flex items-center gap-1 font-medium"><StarIcon /> {item.CommunityRating.toFixed(1)}</span>
              )}
              {runtime && <span className="text-white/60">{runtime}</span>}
              {item.Genres?.slice(0, 3).map((g) => <span key={g} className="text-white/55">· {g}</span>)}
            </div>
          </div>
        </div>

        {item.Overview && (
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/85">{item.Overview}</p>
        )}

        {trailers.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xl font-semibold text-white">{t("extras")}</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {trailers.map((tr, i) => {
                const id = parseYouTubeId(tr.Url);
                return (
                  <button
                    key={tr.Url}
                    type="button"
                    onClick={() => { setTrailerIndex(i); setTrailerOpen(true); }}
                    className="w-[200px] shrink-0 text-left transition-transform hover:scale-[1.02]"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-tentacle-surface ring-1 ring-white/10">
                      <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={tr.Name ?? ""} className="h-full w-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">▶</div>
                      </div>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-sm font-medium text-white">{tr.Name ?? t("trailer")}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {item.People && item.People.length > 0 && (
          <div className="mt-8">
            <CastRow people={item.People} studios={item.Studios} />
          </div>
        )}
      </div>

      <TrailerModal open={trailerOpen} onClose={() => setTrailerOpen(false)} trailers={trailers} initialIndex={trailerIndex} />
    </div>
  );
}
