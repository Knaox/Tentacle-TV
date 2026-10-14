import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemsExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import {
  buildExtraEntries, catalogTiles, scopeName, withSeasonNames, type CatalogRow, type ExtraEntry, type RelayedTrailerEntry,
} from "@tentacle-tv/shared";
import { PlayIcon } from "../media/MediaDetailIcons";
import { HorizontalScrollRow } from "../HorizontalScrollRow";
import { RowHeader } from "../rows/RowHeader";
import { TrailerViewer } from "./TrailerViewer";
import { CatalogTrailerPlayer } from "./CatalogTrailerPlayer";
import { shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";
import { sortTrailersByLang, type RichTrailer } from "./trailerLang";

interface ExtrasRowProps {
  /**
   * Les titres dont on réunit les extras locaux (une série et ses saisons, un
   * épisode et sa saison…) : leurs compteurs évitent de demander une liste
   * vide. Absent : les bandes-annonces distantes seules — la page partagée, où
   * un visiteur sans session ne peut rien lire du serveur.
   */
  owners?: readonly ExtrasOwner[];
  /** Trailers distants attachés à cet item/saison (déjà fusionnés ou bruts). */
  remoteTrailers: RichTrailer[];
  /** Libellé de groupe optionnel (nom de saison). */
  title?: string;
  /**
   * Les vidéos de CETTE portée au catalogue du serveur (lecteur complet) :
   * elles remplacent `remoteTrailers`, et se lisent sans publicité, la suite
   * de la rangée enchaînée.
   */
  catalog?: CatalogRow | null;
  /** Un carrousel qui réunit plusieurs saisons : chaque tuile dit la sienne (`useFicheExtras`). */
  seasonNames?: ReadonlyMap<string, string> | null;
}

/**
 * Rangée « Extras » : bandes-annonces LOCALES et bonus (lus dans le lecteur via
 * /watch), puis trailers DISTANTS (lecteur complet, sinon modale YouTube) — l'ordre et les libellés du
 * modèle partagé (`buildExtraEntries`) ; avec le catalogue, ses vidéos à la
 * place, AlloCiné compris (`catalogExtras.ts`, shared). Masquée si rien à montrer.
 */
const NO_OWNERS: readonly ExtrasOwner[] = [];

export function ExtrasRow({ owners = NO_OWNERS, remoteTrailers, title, catalog = null, seasonNames = null }: ExtrasRowProps) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { local, ownerOf } = useItemsExtras(owners);
  const [modalOpen, setModalOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const [playing, setPlaying] = useState<RelayedTrailerEntry | null>(null);

  const remote = useMemo(
    () => (catalog ? [] : sortTrailersByLang(remoteTrailers, i18n.language)),
    [catalog, remoteTrailers, i18n.language],
  );
  const entries = withSeasonNames(buildExtraEntries(t, local, remote), ownerOf, seasonNames);
  const tiles = useMemo(
    () => (catalog ? catalogTiles(t, catalog, seasonNames ? (scope) => scopeName(t, scope) : undefined) : []),
    [t, catalog, seasonNames],
  );
  if (entries.length === 0 && tiles.length === 0) return null;

  const open = (entry: ExtraEntry) => {
    if (entry.source === "local") {
      navigate(`/watch/${entry.itemId}`);
      return;
    }
    // macOS DMG : ouverture dans le navigateur système (cf. TrailerButton).
    if (shouldOpenYouTubeExternally()) {
      void openExternal(entry.trailer.Url);
      return;
    }
    setStartIndex(Math.max(0, remote.indexOf(entry.trailer)));
    setModalOpen(true);
  };

  return (
    // Même en-tête à rail de marque que les autres sections de la fiche ; le
    // retrait passe de la section à la rangée pour que le rail s'aligne.
    <section className="group/row">
      <RowHeader title={title ? `${t("common:extras")} — ${title}` : t("common:extras")} />
      <HorizontalScrollRow
        wrapperClassName="mt-3"
        className="row-gutter gap-3 overflow-y-visible pb-2"
        ariaLabel={t("common:extras")}
      >
        {entries.map((entry) => (
          <ExtraTile
            key={entry.key}
            label={entry.title}
            sublabel={entry.subtitle}
            thumb={entry.source === "local"
              ? client.getImageUrl(entry.itemId, "Primary", { width: 320, quality: 80 })
              : entry.thumbUrl ?? undefined}
            youtubeId={entry.source === "remote" ? entry.youtubeId ?? undefined : undefined}
            onClick={() => open(entry)}
          />
        ))}
        {tiles.map((tile) => (
          <ExtraTile
            key={tile.key}
            label={tile.title}
            sublabel={tile.subtitle}
            thumb={tile.thumbUrl}
            youtubeId={tile.youtubeId ?? undefined}
            onClick={() => setPlaying(tile.entry)}
          />
        ))}
      </HorizontalScrollRow>
      {remote.length > 0 && (
        <TrailerViewer
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          trailers={remote}
          initialIndex={startIndex}
        />
      )}
      {playing && catalog && (
        <CatalogTrailerPlayer entries={catalog.entries} start={playing} language={catalog.language} onClose={() => setPlaying(null)} />
      )}
    </section>
  );
}

function ExtraTile({
  label,
  sublabel,
  thumb,
  youtubeId,
  onClick,
}: {
  label: string;
  sublabel?: string;
  thumb?: string;
  /** Si présent : vignette YouTube + détection vidéo indisponible/privée. */
  youtubeId?: string;
  onClick: () => void;
}) {
  // YouTube renvoie un placeholder gris 120x90 sur hqdefault.jpg pour les vidéos
  // supprimées ou privées → on masque la tuile au chargement de la vignette.
  const [unavailable, setUnavailable] = useState(false);
  // Un extra local sans image (aucune vignette extraite) garde la tuile, sur
  // son fond, plutôt qu'une icône d'image cassée.
  const [broken, setBroken] = useState(false);
  if (unavailable) return null;
  const src = broken ? undefined : thumb;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/extra flex w-44 flex-shrink-0 cursor-pointer flex-col text-left sm:w-52"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-surface-2 transition-transform duration-200 group-hover/extra:scale-[1.03]">
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy" decoding="async"
            className="h-full w-full object-cover"
            onLoad={
              youtubeId
                ? (e) => {
                    if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) {
                      setUnavailable(true);
                    }
                  }
                : undefined
            }
            onError={() => (youtubeId ? setUnavailable(true) : setBroken(true))}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-disabled">
            <PlayIcon />
          </div>
        )}
        {/* Halo lecture posé SUR la vignette : reste blanc/noir dans les deux
            thèmes (cf. règle « posé sur média »). Un voile en fondu
            d'OPACITÉ, pas une couleur de fond animée (peinture par image). */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition-opacity duration-200 group-hover/extra:opacity-100">
          <PlayIcon />
        </div>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-content-primary" title={label}>{label}</p>
      {sublabel && <p className="truncate text-xs text-content-quaternary">{sublabel}</p>}
    </button>
  );
}
