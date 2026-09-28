import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalTrailers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FilmIcon } from "../media/MediaDetailIcons";
import { TrailerModal } from "./TrailerModal";
import { shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";
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
    // macOS DMG : WKWebView strip le Referer pour les iframes sous frame racine
    // tauri:// → YouTube refuse l'embed (erreur 153). On ouvre dans le navigateur
    // système où le top-level est youtube.com (pas de problème de Referer).
    if (shouldOpenYouTubeExternally() && remote[0]?.Url) {
      void openExternal(remote[0].Url);
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
        // Posé sur la scène : `on-media`, sans flou (le voile dessous est déjà
        // sombre, un `backdrop-filter` n'y changerait rien de visible).
        className="flex h-14 items-center gap-2.5 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.38)] px-6 text-base font-semibold text-on-media-primary transition-colors duration-150 hover:bg-[rgba(var(--scrim-media-rgb),0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        <FilmIcon /> {t("common:trailer")}
      </button>
      {remote.length > 0 && (
        <TrailerModal open={modalOpen} onClose={() => setModalOpen(false)} trailers={remote} />
      )}
    </>
  );
}
