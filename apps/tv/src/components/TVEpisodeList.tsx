import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useSeasonBrowser, useSeriesWatchState, useJellyfinClient } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVSeasonPills } from "./episodes/TVSeasonPills";
import { TVEpisodePanelList } from "./episodes/TVEpisodePanelList";
import { TVEpisodePageList } from "./episodes/TVEpisodePageList";
import { EPISODE_ROW_GAP, episodeRowHeight } from "./TVEpisodeRow";
import { Radius, Spacing } from "../theme/colors";

interface TVEpisodeListProps {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  /** Force l'épisode surligné (fiche épisode / lecteur) — sinon l'épisode du watch state */
  currentEpisodeId?: string;
  /** Saison présélectionnée (fiche épisode / lecteur) — sinon celle de l'épisode courant */
  initialSeasonId?: string;
  /** Texte du badge de l'épisode surligné (ex. « En cours de visionnage » dans le lecteur) */
  currentBadgeLabel?: string;
  /** Focus D-pad initial sur la row de l'épisode surligné (panneau du lecteur) */
  autoFocusCurrent?: boolean;
  /** Liste en flex:1 avec son propre défilement, virtualisée (panneau plein
   *  écran du lecteur). Sans lui (fiche média), la liste vit à hauteur
   *  NATURELLE dans le défilement de la page : un ScrollView borné imbriqué
   *  dans celui de la fiche piégeait le focus D-pad. */
  fillHeight?: boolean;
  /** Largeur de vignette relayée aux lignes (160 dans le panneau du lecteur). */
  thumbWidth?: number;
  /** Fiche média : Y local (relatif à la liste) de la ligne focalisée — la PAGE
   *  défile pour la suivre, la liste n'ayant pas de défilement propre. */
  onEpisodeFocus?: (y: number) => void;
}

export function TVEpisodeList({
  seriesId, onPlay, currentEpisodeId, initialSeasonId, currentBadgeLabel, autoFocusCurrent,
  fillHeight, thumbWidth = 200, onEpisodeFocus,
}: TVEpisodeListProps) {
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  // Épisode « courant » (à reprendre / prochain) — surligné comme sur le web,
  // et sa saison est présélectionnée. Le lecteur n'en a pas l'usage : il nomme
  // l'épisode ET son badge, et la requête parcourt TOUTE la série.
  const followWatch = !currentBadgeLabel;
  const watch = useSeriesWatchState(followWatch ? seriesId : undefined);
  const watchState = watch.data;
  const currentEp = watchState && watchState.type !== "completed" ? watchState.episode : undefined;
  // La mécanique commune (`useSeasonBrowser`) : liste légère puis sources,
  // voisines préchargées. Fiche série : tant que l'état de visionnage n'a pas
  // répondu, on ne sait pas quelle saison ouvrir — et une liste qui changerait
  // sous le focus de la télécommande le perdrait : on attend (`provisional:
  // false`), mais la saison pressentie se précharge pendant ce temps.
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    followResume: followWatch && !currentEpisodeId && !initialSeasonId,
    currentEpisodeSeasonId: initialSeasonId,
    provisional: false,
  });
  const { seasons, episodes } = browser;
  const activeSeasonId = browser.selectedSeasonId;

  const highlightId = currentEpisodeId ?? currentEp?.Id;

  /**
   * Choisir une saison mène à ses épisodes (parité LG) : la première ligne de
   * la saison choisie prend le focus dès qu'elle est montée — ou l'épisode en
   * cours, si c'est sa saison. Sans cela on restait sur la bande, à devoir
   * redescendre à la main après chaque changement.
   */
  const [seasonNonce, setSeasonNonce] = useState(0);
  const { select } = browser;
  const chooseSeason = useCallback((seasonId: string) => {
    select(seasonId);
    setSeasonNonce((n) => n + 1);
  }, [select]);

  const highlightIndex = episodes?.findIndex((e) => e.Id === highlightId) ?? -1;
  const claimIndex = seasonNonce > 0 || autoFocusCurrent ? Math.max(0, highlightIndex) : -1;

  // Badge violet : override (lecteur : « En cours de visionnage ») sinon
  // Reprendre (en cours) / À suivre (watch state) / Épisode actuel (fiche épisode)
  const currentEpId = currentEp?.Id;
  const badgeFor = useCallback((ep: MediaItem): string | null => {
    if (ep.Id !== highlightId) return null;
    if (currentBadgeLabel) return currentBadgeLabel;
    if ((ep.UserData?.PlaybackPositionTicks ?? 0) > 0) return t("resume");
    if (ep.Id === currentEpId) return t("nextEpisode");
    return t("currentEpisode");
  }, [highlightId, currentBadgeLabel, currentEpId, t]);

  // La vignette au double de sa largeur en points : l'Apple TV 4K rend à ×2.
  const thumbUrlFor = useCallback(
    (ep: MediaItem) => client.getImageUrl(ep.Id, "Primary", { width: thumbWidth * 2, quality: 80 }),
    [client, thumbWidth],
  );

  // Rappel STABLE : la fiche passe une flèche neuve à chaque rendu, et elle
  // redessinerait chaque ligne mémoïsée.
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const handlePress = useCallback((ep: MediaItem) => onPlayRef.current(ep), []);

  const rows = episodes && episodes.length > 0 ? {
    episodes, claimIndex, claimNonce: seasonNonce, highlightId, badgeFor, thumbUrlFor, thumbWidth,
    onPress: handlePress,
  } : null;

  return (
    <View style={fillHeight ? { flex: 1 } : undefined}>
      <TVSeasonPills
        seasons={seasons}
        activeSeasonId={activeSeasonId}
        markedSeasonId={browser.markedSeasonId}
        onSelect={chooseSeason}
        onIntent={browser.prefetch}
      />
      {/* Une liste par saison (clé) : le focus d'entrée et la position de
          départ se recalculent à chaque changement, sans reste de la précédente. */}
      {rows == null ? (
        browser.episodesLoading ? <EpisodeGhosts thumbWidth={thumbWidth} /> : null
      ) : fillHeight ? (
        <TVEpisodePanelList key={activeSeasonId} {...rows} />
      ) : (
        <TVEpisodePageList key={activeSeasonId} {...rows} onEpisodeFocus={onEpisodeFocus} />
      )}
    </View>
  );
}

/**
 * Tant que la saison n'a pas répondu, des lignes fantômes à la hauteur exacte
 * des vraies disent l'attente et réservent la place : la liste ne saute pas
 * quand elle arrive.
 */
function EpisodeGhosts({ thumbWidth }: { thumbWidth: number }) {
  const height = episodeRowHeight(thumbWidth);
  return (
    <View style={{ marginTop: 16, paddingTop: 8, paddingHorizontal: Spacing.screenPadding, gap: EPISODE_ROW_GAP }}>
      {Array.from({ length: 4 }, (_, i) => (
        <View
          key={i}
          style={{ height, borderRadius: Radius.card, backgroundColor: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </View>
  );
}
