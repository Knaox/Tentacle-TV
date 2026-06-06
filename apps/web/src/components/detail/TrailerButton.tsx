import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalTrailers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FilmIcon } from "../media/MediaDetailIcons";
import { TrailerModal } from "./TrailerModal";
import { useItemRemoteTrailers } from "../../hooks/useItemRemoteTrailers";

/**
 * Bouton « Bande-annonce » sur la page détail (film ET série).
 *
 * Comportement Jellyfin — local d'abord :
 *  - trailer local présent → lecture directe dans le player Tentacle (/watch/{id}) ;
 *  - sinon trailer distant (YouTube) → modale d'embed.
 * Masqué si aucun trailer (local ni distant) : pas de bouton mort.
 */
export function TrailerButton({ item }: { item: MediaItem }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: localTrailers } = useLocalTrailers(item.Id);
  // Trailers distants fusionnés (Jellyfin + TMDB), dédupliqués et triés par langue.
  const remote = useItemRemoteTrailers(item);
  const [modalOpen, setModalOpen] = useState(false);

  const local = localTrailers ?? [];
  if (local.length === 0 && remote.length === 0) return null;

  const handleClick = () => {
    if (local.length > 0) {
      navigate(`/watch/${local[0].Id}`);
      return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("common:watchTrailer")}
        className="flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-5 py-3 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-150 hover:border-white/50 hover:bg-white/20"
      >
        <FilmIcon /> {t("common:trailer")}
      </button>
      {remote.length > 0 && (
        <TrailerModal open={modalOpen} onClose={() => setModalOpen(false)} trailers={remote} />
      )}
    </>
  );
}
