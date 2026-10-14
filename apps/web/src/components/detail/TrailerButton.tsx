import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemTrailer } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FilmIcon } from "../media/MediaDetailIcons";
import { parseYouTubeId } from "@tentacle-tv/shared";
import { TrailerViewer, useFullTrailerPlayer } from "./TrailerViewer";
import { useTrailerIntent } from "../trailerPlayer";
import { shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";

/**
 * Bouton « Bande-annonce » sur la page détail (film ET série).
 *
 * Même règle sur toutes les plateformes (`useItemTrailer`) — local d'abord :
 *  - trailer local présent → lecture directe dans le player Tentacle (/watch/{id}) ;
 *  - sinon trailer distant (YouTube) → le lecteur complet, sans publicité
 *    (`TrailerViewer` ; la modale d'embed face à un serveur d'avant). Le
 *    survol du bouton fait préparer la vidéo (`useTrailerIntent`).
 * Masqué si aucun trailer (local ni distant) : pas de bouton mort. Posé dès que
 * la fiche ANNONCE une bande-annonce locale (`LocalTrailerCount`), sans attendre
 * sa liste : la rangée d'actions ne bouge pas une fraction de seconde après.
 */
export function TrailerButton({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { target, visible, remote } = useItemTrailer(item, i18n.language);
  const [modalOpen, setModalOpen] = useState(false);
  const full = useFullTrailerPlayer();
  const remoteId = full && target?.kind === "remote" ? parseYouTubeId(target.trailer.Url) : null;
  const intent = useTrailerIntent(remoteId ? { kind: "youtube", ytId: remoteId } : null);

  if (!visible) return null;

  const handleClick = () => {
    // Bande-annonce locale annoncée, liste encore en route : rien à lancer
    // pour l'instant — elle arrive en quelques millisecondes.
    if (!target) return;
    if (target.kind === "local") {
      navigate(`/watch/${target.itemId}`);
      return;
    }
    // macOS DMG : WKWebView strip le Referer pour les iframes sous frame racine
    // tauri:// → YouTube refuse l'embed (erreur 153). On ouvre dans le navigateur
    // système où le top-level est youtube.com (pas de problème de Referer).
    if (shouldOpenYouTubeExternally()) {
      void openExternal(target.trailer.Url);
      return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        {...intent}
        aria-label={t("common:watchTrailer")}
        // Posé sur la scène : `on-media`, sans flou (le voile dessous est déjà
        // sombre, un `backdrop-filter` n'y changerait rien de visible).
        className="flex h-14 items-center gap-2.5 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.38)] px-6 text-base font-semibold text-on-media-primary transition-colors duration-150 hover:bg-[rgba(var(--scrim-media-rgb),0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        <FilmIcon /> {t("common:trailer")}
      </button>
      {remote.length > 0 && (
        <TrailerViewer open={modalOpen} onClose={() => setModalOpen(false)} trailers={remote} />
      )}
    </>
  );
}
