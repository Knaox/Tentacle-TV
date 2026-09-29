import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import { buildExtraEntries, type ExtraEntry } from "@tentacle-tv/shared";
import { PlayIcon } from "../media/MediaDetailIcons";
import { HorizontalScrollRow } from "../HorizontalScrollRow";
import { RowHeader } from "../rows/RowHeader";
import { TrailerModal } from "./TrailerModal";
import { shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";
import { sortTrailersByLang, type RichTrailer } from "./trailerLang";

interface ExtrasRowProps {
  /**
   * Le titre dont on liste les extras locaux (film, série, saison, épisode) :
   * ses compteurs évitent de demander une liste vide. Absent : les
   * bandes-annonces distantes seules — la page partagée, où un visiteur sans
   * session ne peut rien lire du serveur.
   */
  owner?: ExtrasOwner;
  /** Trailers distants attachés à cet item/saison (déjà fusionnés ou bruts). */
  remoteTrailers: RichTrailer[];
  /** Libellé de groupe optionnel (nom de saison). */
  title?: string;
}

/**
 * Rangée « Extras » : bandes-annonces LOCALES et bonus (lus dans le lecteur via
 * /watch), puis trailers DISTANTS (modale YouTube) — l'ordre et les libellés du
 * modèle partagé (`buildExtraEntries`). Masquée si rien à montrer.
 */
export function ExtrasRow({ owner, remoteTrailers, title }: ExtrasRowProps) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { local } = useItemExtras(owner);
  const [modalOpen, setModalOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const remote = useMemo(() => sortTrailersByLang(remoteTrailers, i18n.language), [remoteTrailers, i18n.language]);
  const entries = useMemo(() => buildExtraEntries(t, local, remote), [t, local, remote]);
  if (entries.length === 0) return null;

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
      </HorizontalScrollRow>
      {remote.length > 0 && (
        <TrailerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          trailers={remote}
          initialIndex={startIndex}
        />
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
