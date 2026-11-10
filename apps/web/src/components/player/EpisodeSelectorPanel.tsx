import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { usePlayerGlassMode } from "./glass/PlayerGlassContext";
import { isGlassLayout } from "./glass/playerGlassMode";
import { GlassPanel } from "./glass/GlassPanel";
import { PLAYER_MORPH } from "./glass/playerGlassFusion";
import { PANEL_MOTION } from "./chrome/panelMotion";
import { PanelHeader } from "./chrome/PanelHeader";
import "./chrome/playerChrome.css";
import {
  useSeasonBrowser,
  useJellyfinClient,
  useMediaItem,
  useMyEpisodeRatings,
  useTmdbSeasonEpisodes,
} from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode, resolveCardMarkers } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { SeasonTabs } from "../episodes/SeasonTabs";
import { EpisodeScoreChips } from "../rating/EpisodeRatingLine";
import { tmdbIdForItem } from "../../lib/ratingIdentity";
import { CardProgressBar } from "../cards/CardProgressBar";
import { CardStatusMarkers } from "../cards/CardStatusMarkers";

interface EpisodeSelectorPanelProps {
  seriesId: string;
  currentEpisodeId: string;
  currentSeasonId?: string;
  onClose: () => void;
}

/**
 * Panneau « Épisodes » intégré au lecteur (style Netflix) : onglets de saisons +
 * liste d'épisodes scrollable. Cliquer un épisode lance sa lecture (remplace
 * l'entrée /watch courante). Réutilise le pattern glass du TrackSelector et les
 * chips actifs du thème (brand-soft / brand-light).
 */
export function EpisodeSelectorPanel({
  seriesId,
  currentEpisodeId,
  currentSeasonId,
  onClose,
}: EpisodeSelectorPanelProps) {
  const { t } = useTranslation("player");
  const navigate = useNavigate();
  // Sans leurs sources : le panneau n'affiche ni qualité ni langues, et le
  // serveur mettait une demi-seconde à calculer les sources d'une longue saison
  // (196 épisodes : 2,7 Mo contre 0,3). Le bureau et la LG en profitent. La
  // mécanique est celle de la fiche : voisines préchargées, préchargement au
  // survol, saison de l'épisode en lecture marquée.
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: currentSeasonId,
    currentEpisodeSeasonId: currentSeasonId,
    sources: false,
  });
  const { seasons, episodes } = browser;
  const effectiveSeasonId = browser.selectedSeasonId;
  // Notes des épisodes (TMDB + compte) : un cache par saison, un seul abonnement.
  const { data: series } = useMediaItem(seriesId);
  const seriesTmdbId = tmdbIdForItem(series);
  const seasonNumber = seasons?.find((s) => s.Id === effectiveSeasonId)?.IndexNumber ?? null;
  const { data: tmdbEpisodes } = useTmdbSeasonEpisodes(seriesTmdbId, seasonNumber);
  const myRatings = useMyEpisodeRatings(seriesTmdbId, seasonNumber);

  // L'épisode courant s'amène à l'écran de lui-même, une fois par ouverture —
  // une saison longue ne se parcourt plus à la molette (parité mobile/TV).
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!episodes?.some((ep) => ep.Id === currentEpisodeId)) return;
    activeItemRef.current?.scrollIntoView({ block: "center" });
    didAutoScrollRef.current = true;
  }, [episodes, currentEpisodeId]);

  const select = (id: string) => {
    if (id !== currentEpisodeId) navigate(`/watch/${id}`, { replace: true });
    onClose();
  };

  const glass = isGlassLayout(usePlayerGlassMode());
  const body = (
    <>
      <div className="px-1.5 pb-1 pt-1.5">
        <PanelHeader title={t("player:episodes")} onClose={onClose} />
      </div>

      {seasons && seasons.length > 1 && (
        <div className="px-2 pb-2">
          <SeasonTabs
            seasons={seasons}
            selectedId={effectiveSeasonId}
            markedId={browser.markedSeasonId}
            onSelect={browser.select}
            onIntent={browser.prefetch}
            size="sm"
            arrows={glass ? "glyph" : "disc"}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto border-t border-line-subtle p-1.5 scrollbar-thin">
        {episodes?.map((ep) => (
          <EpisodeItem
            key={ep.Id}
            ep={ep}
            active={ep.Id === currentEpisodeId}
            innerRef={ep.Id === currentEpisodeId ? activeItemRef : undefined}
            onClick={() => select(ep.Id)}
            community={ep.IndexNumber != null ? (tmdbEpisodes?.get(ep.IndexNumber)?.voteAverage ?? ep.CommunityRating ?? null) : null}
            mine={ep.IndexNumber != null ? (myRatings.get(ep.IndexNumber) ?? null) : null}
          />
        ))}
        {!browser.episodesLoading && (!episodes || episodes.length === 0) && (
          <p className="px-3 py-8 text-center text-sm text-content-quaternary">{t("player:noEpisodes")}</p>
        )}
      </div>
    </>
  );
  // Verre : le popover au-dessus de la capsule (`GlassPanel`), mêmes lignes.
  if (glass) {
    return (
      <GlassPanel morphId={PLAYER_MORPH.episodes} className="flex max-h-[65vh] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden" bodyClassName="flex min-h-0 flex-1 flex-col">
        {body}
      </GlassPanel>
    );
  }
  return (
    // Panneau DÉTACHÉ (même traitement que TrackSelector) : un menu du socle, opaque,
    // qui suit le thème clair/sombre — pas posé sur la vidéo.
    //
    // Et donc PAS de `backdrop-filter` : à 0,95 d'alpha il ne reste rien à
    // flouter, alors que le panneau flotte au-dessus d'une vidéo en lecture —
    // son arrière-plan change vingt-quatre à soixante fois par seconde, et
    // chaque changement forçait une recopie de la région et une passe de flou
    // de 24 px sur 26 rem par 65 vh.
    <motion.div data-panneau-detache
      {...PANEL_MOTION}
      role="dialog" aria-label={t("player:episodes")}
      className="pl-panel ui-menu flex max-h-[65vh] w-[26rem] flex-col overflow-hidden !p-0"
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </motion.div>
  );
}

function EpisodeItem({ ep, active, onClick, innerRef, community, mine }: {
  ep: MediaItem; active: boolean; onClick: () => void;
  /** Note globale (TMDB, Jellyfin à défaut) et note du compte — affichage seul. */
  community: number | null; mine: number | null;
  /** Posée sur l'épisode courant — cible du défilement automatique. */
  innerRef?: React.Ref<HTMLButtonElement>;
}) {
  const client = useJellyfinClient();
  const thumb = client.getImageUrl(ep.Id, "Primary", { width: 240, quality: 80 });
  // Le modèle des marqueurs, réduit à ce que la ligne dit d'un épisode : « vu ».
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false });
  const watched = markers.statuses.includes("watched");
  const progress = ep.UserData?.PlayedPercentage;
  const runtime = formatDuration(ep.RunTimeTicks);
  const epLabel = formatEpisodeCode(ep.ParentIndexNumber, ep.IndexNumber, { style: "padded" });

  return (
    <button
      ref={innerRef}
      onClick={onClick}
      type="button"
      aria-current={active ? "true" : undefined}
      // L'épisode en cours : une teinte d'encre, et son numéro à la teinte franche — plus d'aplat rose.
      className={`flex w-full items-center gap-3 rounded-field p-2 text-left transition-colors duration-hover ${
        active ? "bg-fill-soft" : "hover:bg-fill-subtle"
      }`}
    >
      {/* Vignette = image média : la pastille « vu » et la barre de TOUTES les
          cartes (un disque blanc recopié ici avait fini par diverger). */}
      <div className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-chip bg-surface-2">
        <img src={thumb} alt={ep.Name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {!watched && <CardProgressBar percent={progress} />}
        <CardStatusMarkers statuses={markers.statuses} className="right-1 top-1" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-bold uppercase tracking-wider ${active ? "text-accent" : "text-content-tertiary"}`}>
          {epLabel}
        </p>
        <p className="line-clamp-1 text-sm font-medium text-content-primary">{ep.Name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-content-tertiary">
          {runtime && <span>{runtime}</span>}
          <EpisodeScoreChips community={community} mine={mine} />
        </p>
      </div>
    </button>
  );
}
