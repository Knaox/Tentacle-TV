import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSpecialFeatures, useJellyfinClient } from "@tentacle-tv/api-client";
import { PlayIcon } from "../media/MediaDetailIcons";
import { TrailerModal } from "./TrailerModal";
import { parseYouTubeId, shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";
import { sortTrailersByLang, type RichTrailer } from "./trailerLang";

interface ExtrasRowProps {
  /** Item dont on liste les special features (film ou saison). */
  itemId: string;
  /** Trailers distants attachés à cet item/saison (déjà fusionnés ou bruts). */
  remoteTrailers: RichTrailer[];
  /** Libellé de groupe optionnel (nom de saison). */
  title?: string;
}

/**
 * Rangée « Extras » : special features LOCAUX (jouables in-player via /watch) +
 * trailers DISTANTS (ouverts dans la modale YouTube). Masquée si rien à montrer.
 */
export function ExtrasRow({ itemId, remoteTrailers, title }: ExtrasRowProps) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: features } = useSpecialFeatures(itemId);
  const [modalOpen, setModalOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const local = features ?? [];
  const remote = sortTrailersByLang(remoteTrailers, i18n.language);
  if (local.length === 0 && remote.length === 0) return null;

  return (
    <section className="row-gutter mb-8">
      <h2 className="mb-3 text-base font-semibold text-white/90 md:text-lg">
        {title ? `${t("common:extras")} — ${title}` : t("common:extras")}
      </h2>
      <div className="flex gap-3 overflow-x-auto overflow-y-visible pb-2 scrollbar-hide">
        {local.map((ex) => (
          <ExtraTile
            key={ex.Id}
            label={ex.Name}
            sublabel={ex.Type}
            thumb={client.getImageUrl(ex.Id, "Primary", { width: 320, quality: 80 })}
            onClick={() => navigate(`/watch/${ex.Id}`)}
          />
        ))}
        {remote.map((tr, i) => {
          const yt = parseYouTubeId(tr.Url);
          return (
            <ExtraTile
              key={tr.Url}
              label={tr.Name || t("common:trailer")}
              sublabel={tr.type || "YouTube"}
              thumb={yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : undefined}
              onClick={() => {
                // macOS DMG : ouverture dans le navigateur système (cf. TrailerButton).
                if (shouldOpenYouTubeExternally()) {
                  void openExternal(tr.Url);
                  return;
                }
                setStartIndex(i);
                setModalOpen(true);
              }}
            />
          );
        })}
      </div>
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
  onClick,
}: {
  label: string;
  sublabel?: string;
  thumb?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/extra flex w-44 flex-shrink-0 cursor-pointer flex-col text-left sm:w-52"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-surface-2 transition-transform duration-200 group-hover/extra:scale-[1.03]">
        {thumb ? (
          <img src={thumb} alt={label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/25">
            <PlayIcon />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition-colors duration-200 group-hover/extra:bg-black/35">
          <span className="opacity-0 transition-opacity duration-200 group-hover/extra:opacity-100">
            <PlayIcon />
          </span>
        </div>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-white/90">{label}</p>
      {sublabel && <p className="truncate text-xs text-white/45">{sublabel}</p>}
    </button>
  );
}
