import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import {
  useItemExtras, useItemTrailer, useJellyfinClient, useRemoteTrailers, useSeasons, type ExtrasOwner,
} from "@tentacle-tv/api-client";
import {
  buildExtraEntries, catalogEntriesByScope, catalogRowFor, catalogTiles, seasonHasExtras, seasonScopeKey, sortTrailersByLang,
  type CatalogRow, type CatalogScopes, type MediaItem, type RelayedTrailerEntry, type RichTrailer,
} from "@tentacle-tv/shared";
import { useWebTrailerPlatform } from "../../../components/detail/trailerPlatform";
import { CatalogTrailerPlayer } from "../../../components/detail/CatalogTrailerPlayer";

const W = 168;
const H = 95;

/**
 * `MobileExtrasSection` de l'app : film → ses bandes-annonces, bonus et vidéos
 * distantes ; série → les siens puis une rangée par saison qui en a ; épisode
 * → les siens, puis ceux de SA saison, de la série et des autres saisons.
 * Avec le catalogue du serveur (lecteur complet), ses vidéos nourrissent les
 * rangées, portée par portée, comme sur le web (`catalogExtras`, shared).
 * Chaque rangée s'efface quand elle est vide. Tuiles, ordre et libellés : le
 * modèle partagé.
 */
export const ExtrasSection = memo(function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const platform = useWebTrailerPlatform();
  const { entries, language } = useItemTrailer(item, i18n.language, platform);
  const scopes = useMemo(
    () => (platform.playable.includes("dailymotion") && entries.length > 0 ? catalogEntriesByScope(entries, language) : null),
    [platform, entries, language],
  );
  const remote = useRemoteTrailers(scopes ? undefined : item, i18n.language);
  if (item.Type === "Series") return <SeriesExtras item={item} remote={remote} scopes={scopes} />;
  if (item.Type === "Episode") {
    return (
      <>
        <ExtrasRow owner={item} remoteTrailers={scopes ? [] : remote} />
        {seriesItem && <SeriesExtrasAuto item={seriesItem} scopes={scopes} currentSeason={item.ParentIndexNumber} />}
      </>
    );
  }
  return <ExtrasRow owner={item} remoteTrailers={remote} catalog={catalogRowFor(scopes, "movie")} />;
});

function SeriesExtrasAuto({ item, scopes, currentSeason }: { item: MediaItem; scopes: CatalogScopes | null; currentSeason?: number | null }) {
  const { i18n } = useTranslation();
  const remote = useRemoteTrailers(scopes ? undefined : item, i18n.language);
  return <SeriesExtras item={item} remote={remote} scopes={scopes} currentSeason={currentSeason} />;
}

function SeriesExtras({ item, remote, scopes, currentSeason }: {
  item: MediaItem; remote: RichTrailer[]; scopes: CatalogScopes | null; currentSeason?: number | null;
}) {
  const { data: seasons } = useSeasons(item.Id);
  // Seulement les saisons qui ont des extras (cf. `seasonHasExtras`) ou des vidéos au catalogue.
  const shown = (seasons ?? []).filter((s) => {
    const key = seasonScopeKey(s.IndexNumber);
    return seasonHasExtras(s) || (key !== null && catalogRowFor(scopes, key) !== null);
  });
  // La saison de l'épisode ouvert passe en tête.
  const current = currentSeason != null ? shown.find((s) => s.IndexNumber === currentSeason) : undefined;
  const seasonRow = (s: MediaItem) => {
    const key = seasonScopeKey(s.IndexNumber);
    return (
      <ExtrasRow
        key={s.Id}
        owner={s}
        title={s.Name}
        remoteTrailers={scopes ? [] : s.RemoteTrailers ?? []}
        catalog={key ? catalogRowFor(scopes, key) : null}
      />
    );
  };
  return (
    <>
      {current && seasonRow(current)}
      <ExtrasRow owner={item} remoteTrailers={scopes ? [] : remote} catalog={catalogRowFor(scopes, "series")} />
      {shown.filter((s) => s !== current).map(seasonRow)}
    </>
  );
}

/**
 * `MobileExtrasRow` de l'app : vignettes 168 × 95 (rayon 8, filet
 * `border.subtle`) et leur pastille de lecture de 34 ; titre 13 et genre 11
 * dessous. Un extra local s'ouvre dans le lecteur, une vidéo du catalogue
 * dans le lecteur complet, une vidéo YouTube d'avant dans un nouvel onglet
 * (le navigateur externe de l'app).
 */
function ExtrasRow({ owner, remoteTrailers, title, catalog = null }: {
  owner: ExtrasOwner; remoteTrailers: RichTrailer[]; title?: string; catalog?: CatalogRow | null;
}) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { local } = useItemExtras(owner);
  const [playing, setPlaying] = useState<RelayedTrailerEntry | null>(null);
  const entries = useMemo(
    () => buildExtraEntries(t, local, catalog ? [] : sortTrailersByLang(remoteTrailers, i18n.language)),
    [t, local, catalog, remoteTrailers, i18n.language],
  );
  const tiles = useMemo(() => (catalog ? catalogTiles(t, catalog) : []), [t, catalog]);
  if (entries.length === 0 && tiles.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-3 px-4 text-[18px] font-bold text-content-primary">{title ?? t("extras")}</h3>
      <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4">
        {entries.map((entry) => (
          <ExtraTile
            key={entry.key}
            title={entry.title}
            subtitle={entry.subtitle}
            thumb={entry.source === "local" ? client.getImageUrl(entry.itemId, "Primary", { width: 360, quality: 75 }) : entry.thumbUrl}
            onPress={() => entry.source === "local"
              ? navigate(`/watch/${entry.itemId}`)
              : window.open(entry.trailer.Url, "_blank", "noopener,noreferrer")}
          />
        ))}
        {tiles.map((tile) => (
          <ExtraTile key={tile.key} title={tile.title} subtitle={tile.subtitle} thumb={tile.thumbUrl} onPress={() => setPlaying(tile.entry)} />
        ))}
      </div>
      {playing && catalog && (
        <CatalogTrailerPlayer entries={catalog.entries} start={playing} language={catalog.language} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function ExtraTile({ title, subtitle, thumb, onPress }: { title: string; subtitle?: string; thumb?: string | null; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
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
      <span className="mt-1.5 block truncate text-[13px] font-medium text-content-primary">{title}</span>
      {subtitle ? <span className="block truncate text-[11px] text-content-tertiary">{subtitle}</span> : null}
    </button>
  );
}
