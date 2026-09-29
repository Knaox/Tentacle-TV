import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { useItemExtras, useJellyfinClient, useRemoteTrailers, useSeasons, type ExtrasOwner } from "@tentacle-tv/api-client";
import { buildExtraEntries, seasonHasExtras, sortTrailersByLang, type MediaItem, type RichTrailer } from "@tentacle-tv/shared";

const W = 168;
const H = 95;

/**
 * `MobileExtrasSection` de l'app : film → ses bandes-annonces, bonus et vidéos
 * distantes ; série → les siens puis une rangée par saison qui en a ; épisode
 * → les siens, puis ceux de la série en repli. Chaque rangée s'efface quand
 * elle est vide. Tuiles, ordre et libellés : le modèle partagé.
 */
export const ExtrasSection = memo(function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(item, i18n.language);
  if (item.Type === "Series") return <SeriesExtras item={item} remote={remote} />;
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow owner={item} remoteTrailers={remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} />}
      </>
    );
  }
  return <ExtrasRow owner={item} remoteTrailers={remote} />;
});

function SeriesExtrasAuto({ item }: { item: MediaItem }) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(item, i18n.language);
  return <SeriesExtras item={item} remote={remote} />;
}

function SeriesExtras({ item, remote }: { item: MediaItem; remote: RichTrailer[] }) {
  const { data: seasons } = useSeasons(item.Id);
  return (
    <>
      <ExtrasRow owner={item} remoteTrailers={remote} />
      {/* Seulement les saisons qui ont des extras (cf. `seasonHasExtras`). */}
      {seasons?.filter(seasonHasExtras).map((s) => (
        <ExtrasRow key={s.Id} owner={s} title={s.Name} remoteTrailers={s.RemoteTrailers ?? []} />
      ))}
    </>
  );
}

/**
 * `MobileExtrasRow` de l'app : vignettes 168 × 95 (rayon 8, filet
 * `border.subtle`) et leur pastille de lecture de 34 ; titre 13 et genre 11
 * dessous. Un extra local s'ouvre dans le lecteur, une vidéo YouTube dans un
 * nouvel onglet (le navigateur externe de l'app).
 */
function ExtrasRow({ owner, remoteTrailers, title }: { owner: ExtrasOwner; remoteTrailers: RichTrailer[]; title?: string }) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { local } = useItemExtras(owner);
  const entries = useMemo(
    () => buildExtraEntries(t, local, sortTrailersByLang(remoteTrailers, i18n.language)),
    [t, local, remoteTrailers, i18n.language],
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-3 px-4 text-[18px] font-bold text-content-primary">{title ?? t("extras")}</h3>
      <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4">
        {entries.map((entry) => {
          const thumb = entry.source === "local"
            ? client.getImageUrl(entry.itemId, "Primary", { width: 360, quality: 75 })
            : entry.thumbUrl;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => entry.source === "local"
                ? navigate(`/watch/${entry.itemId}`)
                : window.open(entry.trailer.Url, "_blank", "noopener,noreferrer")}
              className="mirror-detail-fade-press shrink-0 text-left"
              style={{ width: W, ["--press-opacity" as string]: 0.8 }}
            >
              <span
                className="relative block overflow-hidden rounded-lg border border-line-subtle bg-surface-2"
                style={{ width: W, height: H }}
              >
                {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40 text-cta-brand-fg">
                    <Play size={16} aria-hidden />
                  </span>
                </span>
              </span>
              <span className="mt-1.5 block truncate text-[13px] font-medium text-content-primary">{entry.title}</span>
              {entry.subtitle ? <span className="block truncate text-[11px] text-content-tertiary">{entry.subtitle}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
