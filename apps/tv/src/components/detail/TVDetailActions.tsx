import { useCallback } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import { useTranslation } from "react-i18next";
import { useSeriesWatchState, useToggleWatchlist } from "@tentacle-tv/api-client";
import type { MediaItem, RichTrailer } from "@tentacle-tv/shared";
import { formatPosition } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { PlayIcon, BookmarkIcon, BookmarkFilledIcon, MovieIcon } from "../icons/TVIcons";
import { Colors, Spacing, Typography, Radius } from "../../theme/colors";

const pad2 = (n: number) => String(n).padStart(2, "0");

interface TVDetailActionsProps {
  item: MediaItem;
  trailers: RichTrailer[];
  playBtnRef: React.RefObject<View | null>;
  onPlay: (itemId: string) => void;
  onTrailer: (trailer: RichTrailer) => void;
  onFocusButtons: () => void;
}

/**
 * Boutons d'action de la fiche média — miroir de DetailActions (web) :
 * pour une série, l'épisode à lire est résolu via useSeriesWatchState
 * (jamais l'ID de la série → fix ERROR_CODE_IO_BAD_HTTP_STATUS), le label
 * affiche « Reprendre S02E03 » / « Lecture S02E03 », et une série terminée
 * masque le bouton Lecture (parité desktop).
 */
export function TVDetailActions({ item, trailers, playBtnRef, onPlay, onTrailer, onFocusButtons }: TVDetailActionsProps) {
  const { t } = useTranslation("common");
  const isSeries = item.Type === "Series";
  const isBoxSet = item.Type === "BoxSet";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const { add: addToWatchlist, remove: removeFromWatchlist } = useToggleWatchlist(item.Id);

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
    <TVFocusGuideView autoFocus style={{ flexDirection: "row", gap: Spacing.buttonGap }}>
      {showPlay && (
        <Focusable ref={playBtnRef} variant="button" onPress={handlePlay} hasTVPreferredFocus onFocus={onFocusButtons}>
          <View style={{
            backgroundColor: Colors.ctaPrimaryBg,
            paddingHorizontal: 40, paddingVertical: 16,
            borderRadius: Radius.buttonLarge,
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
          onPress={() => onTrailer(trailers[0])}
          onFocus={onFocusButtons}
          accessibilityLabel={t("trailer", { defaultValue: "Bande-annonce" })}
        >
          <View style={{
            backgroundColor: Colors.ctaGhostBg,
            paddingHorizontal: 28, paddingVertical: 16,
            borderRadius: Radius.buttonLarge,
            borderWidth: 1, borderColor: Colors.ctaGhostBorder,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <MovieIcon size={18} color={Colors.textPrimary} />
            <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>
              {t("trailer", { defaultValue: "Bande-annonce" })}
            </Text>
          </View>
        </Focusable>
      )}
      <Focusable
        // Série terminée / BoxSet : la watchlist devient la cible de focus
        // (le re-focus au retour vise playBtnRef)
        ref={showPlay ? undefined : playBtnRef}
        variant="button"
        onPress={() => item.UserData?.Likes ? removeFromWatchlist.mutate() : addToWatchlist.mutate()}
        onFocus={onFocusButtons}
        hasTVPreferredFocus={!showPlay}
      >
        <View style={{
          backgroundColor: Colors.ctaGhostBg,
          paddingHorizontal: 28, paddingVertical: 16,
          borderRadius: Radius.buttonLarge,
          borderWidth: 1, borderColor: Colors.ctaGhostBorder,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          {item.UserData?.Likes
            ? <BookmarkFilledIcon size={18} color={Colors.accentPurple} />
            : <BookmarkIcon size={18} color={Colors.textSecondary} />
          }
          <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>
            {item.UserData?.Likes ? t("removeFromMyList") : t("addToMyList")}
          </Text>
        </View>
      </Focusable>
    </TVFocusGuideView>
  );
}
