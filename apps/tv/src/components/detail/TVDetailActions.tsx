import { useCallback } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useFavoriteForItem,
  useFavoriteSeriesIds,
  useSeriesWatchState,
  useToggleWatchlistForItem,
  useWatchedToggle,
  useWatchlistSeriesIds,
} from "@tentacle-tv/api-client";
import type { MediaItem, RichTrailer } from "@tentacle-tv/shared";
import { formatPosition } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { PlayIcon, BookmarkIcon, BookmarkFilledIcon, MovieIcon } from "../icons/TVIcons";
import {
  CheckCircleFilledIcon,
  CheckCircleIcon,
  HeartFilledIcon,
  HeartIcon,
} from "../icons/TVActionIcons";
import { Colors, Spacing, Typography } from "../../theme/colors";
import { Button, roundButton } from "../../theme/buttons";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Taille des actions rondes — 56 sur la LG (`detail-tv.css` agrandit les
 *  `h-11 w-11` du web). */
const CIRCLE = 56;

interface TVDetailActionsProps {
  item: MediaItem;
  trailers: RichTrailer[];
  playBtnRef: React.RefObject<View | null>;
  onPlay: (itemId: string) => void;
  onTrailer: (trailer: RichTrailer) => void;
  onFocusButtons: () => void;
  /** HAUT depuis une action → la pilule Retour (aucun chevauchement horizontal
   *  avec elle : la cible géométrique n'existe pas, il faut la désigner). */
  nextFocusUp?: number;
}

/**
 * Boutons d'action de la fiche — miroir de `DetailActions` (web) : Lecture
 * (CTA), Bande-annonce, puis les trois actions RONDES Favori · Ma liste · Vu.
 *
 * Pour une série, l'épisode à lire est résolu via useSeriesWatchState (jamais
 * l'ID de la série) ; un épisode reflète l'état Favori/Ma liste de sa SÉRIE
 * (parité web via les Sets de membership) ; Ma liste passe par
 * `useToggleWatchlistForItem`, qui route l'épisode vers sa série et propage
 * l'état au cache — l'appel direct `useToggleWatchlist(item.Id)` ne le
 * faisait pas.
 */
export function TVDetailActions({ item, trailers, playBtnRef, onPlay, onTrailer, onFocusButtons, nextFocusUp }: TVDetailActionsProps) {
  const { t } = useTranslation("common");
  const isSeries = item.Type === "Series";
  const isBoxSet = item.Type === "BoxSet";
  const isEpisode = item.Type === "Episode";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id, {
    seriesId: item.SeriesId,
    seasonId: item.SeasonId,
    itemType: item.Type,
  });
  const watchlistSeries = useWatchlistSeriesIds();
  const favoriteSeries = useFavoriteSeriesIds();

  // Un épisode reflète l'état de sa série ; Movie/Series lisent UserData.
  const isFavorite = isEpisode
    ? item.SeriesId != null && favoriteSeries.has(item.SeriesId)
    : item.UserData?.IsFavorite === true;
  const isInWatchlist = isEpisode
    ? item.SeriesId != null && watchlistSeries.has(item.SeriesId)
    : item.UserData?.Likes === true;
  const isWatched = item.UserData?.Played === true;

  const resumePosition = item.UserData?.PlaybackPositionTicks ?? 0;

  // Label façon web : série → épisode résolu ; film/épisode → position de reprise
  const playLabel = (() => {
    if (isBoxSet) return null;
    if (isSeries) {
      if (!watchState) return t("play"); // résolution en cours — clic ignoré
      if (watchState.type === "completed") return null; // série terminée : pas de bouton (parité desktop)
      const ep = watchState.episode;
      const epLabel = `S${pad2(ep.ParentIndexNumber ?? 0)}E${pad2(ep.IndexNumber ?? 0)}`;
      if (watchState.type === "continue") return `${t("resume")} ${epLabel}`;
      if (watchState.type === "next") return `${t("play")} ${epLabel}`;
      return t("play");
    }
    return resumePosition > 0 ? `${t("resume")} ${formatPosition(resumePosition)}` : t("play");
  })();
  const showPlay = playLabel != null;

  const handlePlay = useCallback(() => {
    if (isSeries) {
      // Ne jamais envoyer l'ID de la série au Player
      if (!watchState || watchState.type === "completed") return;
      onPlay(watchState.episode.Id);
      return;
    }
    onPlay(item.Id);
  }, [isSeries, watchState, onPlay, item.Id]);

  return (
    <TVFocusGuideView autoFocus style={{ flexDirection: "row", alignItems: "center", gap: Spacing.buttonGap }}>
      {showPlay && (
        <Focusable ref={playBtnRef} variant="button" focusRadius={Button.large.borderRadius} onPress={handlePlay} hasTVPreferredFocus onFocus={onFocusButtons} nextFocusUp={nextFocusUp}>
          <View style={{
            backgroundColor: Colors.ctaPrimaryBg,
            paddingHorizontal: 40, paddingVertical: 16,
            ...Button.large,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <PlayIcon size={20} color={Colors.ctaPrimaryFg} />
            <Text style={{ color: Colors.ctaPrimaryFg, ...Typography.buttonLarge }}>{playLabel}</Text>
          </View>
        </Focusable>
      )}
      {trailers.length > 0 && (
        <Focusable
          variant="button"
          focusRadius={Button.large.borderRadius}
          onPress={() => onTrailer(trailers[0])}
          onFocus={onFocusButtons}
          accessibilityLabel={t("trailer")}
          nextFocusUp={nextFocusUp}
        >
          <View style={{
            backgroundColor: Colors.ctaGhostBg,
            paddingHorizontal: 28, paddingVertical: 16,
            ...Button.large,
            borderWidth: 1, borderColor: Colors.ctaGhostBorder,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <MovieIcon size={18} color={Colors.textPrimary} />
            <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>
              {t("trailer")}
            </Text>
          </View>
        </Focusable>
      )}

      <CircleAction
        // Série terminée / BoxSet : le 1er rond devient la cible de focus
        // (le re-focus au retour vise playBtnRef).
        focusRef={showPlay ? undefined : playBtnRef}
        preferred={!showPlay}
        onPress={() => (isFavorite ? removeFav.mutate() : addFav.mutate())}
        onFocus={onFocusButtons}
        nextFocusUp={nextFocusUp}
        label={isFavorite ? t("removeFromFavorites") : t("addToFavorites")}
      >
        {isFavorite ? <HeartFilledIcon size={22} /> : <HeartIcon size={22} color={Colors.textSecondary} />}
      </CircleAction>

      <CircleAction
        onPress={() => (isInWatchlist ? removeWatchlist.mutate() : addWatchlist.mutate())}
        onFocus={onFocusButtons}
        nextFocusUp={nextFocusUp}
        label={isInWatchlist ? t("removeFromMyList") : t("addToMyList")}
      >
        {isInWatchlist
          ? <BookmarkFilledIcon size={20} color={Colors.accentPurple} />
          : <BookmarkIcon size={20} color={Colors.textSecondary} />}
      </CircleAction>

      <CircleAction
        onPress={() => (isWatched ? markUnwatched.mutate() : markWatched.mutate())}
        onFocus={onFocusButtons}
        nextFocusUp={nextFocusUp}
        label={isWatched ? t("markUnwatched") : t("markWatched")}
      >
        {isWatched
          ? <CheckCircleFilledIcon size={22} color={Colors.accentPink} />
          : <CheckCircleIcon size={22} color={Colors.textSecondary} />}
      </CircleAction>
    </TVFocusGuideView>
  );
}

/** Une action ronde de 56, icône seule — le libellé vit dans l'accessibilité,
 *  comme les `CircleAction` du web. */
function CircleAction({
  focusRef,
  preferred,
  onPress,
  onFocus,
  nextFocusUp,
  label,
  children,
}: {
  focusRef?: React.RefObject<View | null>;
  preferred?: boolean;
  onPress: () => void;
  onFocus: () => void;
  nextFocusUp?: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Focusable
      ref={focusRef}
      variant="button"
      focusRadius={roundButton(CIRCLE).borderRadius}
      onPress={onPress}
      onFocus={onFocus}
      hasTVPreferredFocus={preferred}
      nextFocusUp={nextFocusUp}
      accessibilityLabel={label}
    >
      <View
        style={{
          ...roundButton(CIRCLE),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Colors.ctaGhostBg,
          borderWidth: 1,
          borderColor: Colors.ctaGhostBorder,
        }}
      >
        {children}
      </View>
    </Focusable>
  );
}
