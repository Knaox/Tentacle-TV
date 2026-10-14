import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { useItemsExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import {
  buildExtraEntries, catalogTiles, sortTrailersByLang, type CatalogRow, type MediaItem, type RelayedTrailerEntry, type RichTrailer,
} from "@tentacle-tv/shared";
import { useFicheExtras } from "../../../components/detail/useFicheExtras";
import { CatalogTrailerPlayer } from "../../../components/detail/CatalogTrailerPlayer";
import { scopeName, withSeasonNames } from "../../../components/detail/extrasSeasonNames";

const W = 168;
const H = 95;

/**
 * `MobileExtrasSection` de l'app : UN carrousel (`useFicheExtras`) — film →
 * ses extras ; série → les siens et ceux de toutes ses saisons ; épisode →
 * ceux de SA saison s'il y en a, sinon tous les autres. Avec le catalogue du
 * serveur (lecteur complet), ses vidéos, AlloCiné compris. Il s'efface sans
 * extra. Tuiles, ordre et libellés : le modèle partagé.
 */
export const ExtrasSection = memo(function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { owners, remote, catalog, title, seasonNames } = useFicheExtras(item, seriesItem);
  return <ExtrasRow owners={owners} remoteTrailers={remote} catalog={catalog} title={title} seasonNames={seasonNames} />;
});

/**
 * `MobileExtrasRow` de l'app : vignettes 168 × 95 (rayon 8, filet
 * `border.subtle`) et leur pastille de lecture de 34 ; titre 13 et genre 11
 * dessous. Un extra local s'ouvre dans le lecteur, une vidéo du catalogue
 * dans le lecteur complet, une vidéo YouTube d'avant dans un nouvel onglet
 * (le navigateur externe de l'app).
 */
function ExtrasRow({ owners, remoteTrailers, title, catalog = null, seasonNames = null }: {
  owners: readonly ExtrasOwner[]; remoteTrailers: RichTrailer[]; title?: string; catalog?: CatalogRow | null;
  seasonNames?: ReadonlyMap<string, string> | null;
}) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { local, ownerOf } = useItemsExtras(owners);
  const [playing, setPlaying] = useState<RelayedTrailerEntry | null>(null);
  const entries = withSeasonNames(
    buildExtraEntries(t, local, catalog ? [] : sortTrailersByLang(remoteTrailers, i18n.language)),
    ownerOf,
    seasonNames,
  );
  const tiles = useMemo(
    () => (catalog ? catalogTiles(t, catalog, seasonNames ? (scope) => scopeName(t, scope) : undefined) : []),
    [t, catalog, seasonNames],
  );
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
