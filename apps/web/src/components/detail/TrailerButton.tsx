import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemTrailer } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FilmIcon } from "../media/MediaDetailIcons";
import { parseYouTubeId, trailerButtonReserved, type RelayedTrailerPlayback } from "@tentacle-tv/shared";
import { TrailerViewer, useFullTrailerPlayer } from "./TrailerViewer";
import { useTrailerIntent } from "../trailerPlayer";
import { shouldOpenYouTubeExternally } from "./youtube";
import { openExternal } from "../../lib/openExternal";
import { useWebTrailerPlatform } from "./trailerPlatform";
import { CatalogTrailerPlayer } from "./CatalogTrailerPlayer";
import { GlassButton } from "../ui/glass/GlassButton";

/**
 * Bouton « Bande-annonce » sur la page détail (film ET série).
 *
 * Même règle sur toutes les plateformes (`useItemTrailer`) :
 *  - le CATALOGUE du serveur quand il le déclare : sa première entrée — une
 *    locale dans le player Tentacle (/watch/{id}), une vidéo en ligne
 *    (AlloCiné/Dailymotion, YouTube) dans le lecteur complet, sans publicité,
 *    qui enchaîne la suite du catalogue (`CatalogTrailerPlayer`) ;
 *  - sinon, comme avant : la locale, puis la distante (`TrailerViewer` ; la
 *    modale d'embed face à un serveur d'avant).
 * Le survol du bouton fait préparer la vidéo (`useTrailerIntent`).
 * Masqué si aucun trailer (local ni distant) : pas de bouton mort. Posé dès que
 * la fiche ANNONCE une bande-annonce — locale (`LocalTrailerCount`) ou distante
 * (`RemoteTrailers`, `trailerButtonReserved`) —, sans attendre les listes : la
 * rangée d'actions arrive entière avec la fiche. Un clic avant leur réponse
 * part dès que la vidéo est connue.
 */
export function TrailerButton({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { target, visible, remote, entries, language, settled } = useItemTrailer(item, i18n.language, useWebTrailerPlatform());
  const [modalOpen, setModalOpen] = useState(false);
  /** Un clic arrivé avant la vidéo : il part dès qu'elle est connue. */
  const [wanted, setWanted] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const full = useFullTrailerPlayer();
  const remoteId = full && target?.kind === "remote" ? parseYouTubeId(target.trailer.Url) : null;
  const intentPlayback = useMemo<RelayedTrailerPlayback | null>(
    () => (target?.kind === "relay" ? target.entry.playback : remoteId ? { kind: "youtube", ytId: remoteId } : null),
    [target, remoteId],
  );
  const intent = useTrailerIntent(intentPlayback);
  const reserved = trailerButtonReserved(item, settled);

  const handleClick = () => {
    // Bande-annonce annoncée, listes encore en route : le clic attend la vidéo.
    if (!target) {
      setWanted(true);
      return;
    }
    setWanted(false);
    if (target.kind === "local") {
      navigate(`/watch/${target.itemId}`);
      return;
    }
    if (target.kind === "relay") {
      setPlayerOpen(true);
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

  // La vidéo arrive après un clic : on la lance ; les listes n'ont rien rendu : le clic tombe.
  const clickRef = useRef(handleClick);
  clickRef.current = handleClick;
  useEffect(() => {
    if (!wanted) return;
    if (target) clickRef.current();
    else if (settled) setWanted(false);
  }, [wanted, target, settled]);

  if (!visible && !reserved) return null;

  return (
    <>
      <GlassButton
        onClick={handleClick}
        aria-busy={!target || undefined}
        {...intent}
        aria-label={t("common:watchTrailer")}
        // Verre natif : une capsule de verre clair, glyphes adaptés au décor.
        // Ailleurs, posé sur la scène : `on-media`, sans flou (le voile dessous
        // est déjà sombre, un `backdrop-filter` n'y changerait rien de visible).
        appearance={{ material: "pane", tone: "dark", level: "clear", shape: "capsule" }}
        className="flex h-14 items-center gap-2.5 px-6 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        fallbackClassName="rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.38)] text-on-media-primary transition-colors duration-150 hover:bg-[rgba(var(--scrim-media-rgb),0.6)]"
      >
        <FilmIcon /> {t("common:trailer")}
      </GlassButton>
      {remote.length > 0 && (
        <TrailerViewer open={modalOpen} onClose={() => setModalOpen(false)} trailers={remote} />
      )}
      {playerOpen && target?.kind === "relay" && (
        <CatalogTrailerPlayer entries={entries} start={target.entry} language={language} onClose={() => setPlayerOpen(false)} />
      )}
    </>
  );
}
