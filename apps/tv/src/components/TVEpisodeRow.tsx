import { memo } from "react";
import { View, Text, Image } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { Focusable } from "./focus/Focusable";
import { CheckIcon } from "./icons/TVIcons";
import { TVMetaChips } from "./TVMetaChips";
import { Colors, Typography, Fonts, Radius, CardConfig } from "../theme/colors";

interface TVEpisodeRowProps {
  episode: MediaItem;
  thumbUrl: string;
  isCurrent: boolean;
  /** Badge violet « Reprendre » / « À suivre » / « Épisode actuel » (null = pas de badge) */
  badgeLabel: string | null;
  /** Focus initial D-pad sur cette row (panneau du lecteur) */
  autoFocus?: boolean;
  /** Largeur de la vignette 16:9 — 200 sur la fiche, 160 dans le panneau du
   *  lecteur (parité `.panneau-tv .aspect-video`). */
  thumbWidth?: number;
  onPress: () => void;
  onFocus: () => void;
}

/**
 * Ligne épisode (thumbnail 16:9 + infos) — miroir de EpisodeRow (web) :
 * durée + date de diffusion + chips qualité/langues, épisode courant surligné.
 * Mémoïsée : la liste re-rend à chaque déplacement de focus.
 */
export const TVEpisodeRow = memo(function TVEpisodeRow({
  episode: ep, thumbUrl, isCurrent, badgeLabel, autoFocus, thumbWidth = 200, onPress, onFocus,
}: TVEpisodeRowProps) {
  const progress = ep.UserData?.PlayedPercentage ?? 0;
  const isWatched = ep.UserData?.Played === true;
  const runtime = ep.RunTimeTicks ? formatDuration(ep.RunTimeTicks) : null;
  const premiereDate = ep.PremiereDate ? new Date(ep.PremiereDate) : null;
  const dateLabel = premiereDate && !isNaN(premiereDate.getTime())
    ? premiereDate.toLocaleDateString()
    : null;

  return (
    <Focusable variant="row" onPress={onPress} onFocus={onFocus} hasTVPreferredFocus={autoFocus}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 20,
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: Radius.card,
        backgroundColor: isCurrent ? "rgba(139, 92, 246, 0.14)" : "rgba(255,255,255,0.04)",
        borderWidth: isCurrent ? 1 : 0,
        borderColor: isCurrent ? "rgba(139, 92, 246, 0.45)" : "transparent",
      }}>
        {/* Thumbnail */}
        <View style={{
          width: thumbWidth, aspectRatio: 16 / 9,
          borderRadius: Radius.small, overflow: "hidden",
          backgroundColor: Colors.bgElevated,
        }}>
          <Image
            source={{ uri: thumbUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          {progress > 0 && !isWatched && (
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: CardConfig.progressBarHeight, backgroundColor: "rgba(0,0,0,0.5)",
            }}>
              <View style={{
                height: CardConfig.progressBarHeight,
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: Colors.accentPurple, borderRadius: 2,
              }} />
            </View>
          )}
          {isWatched && (
            <View style={{
              position: "absolute", top: 6, right: 6,
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: Colors.success,
              justifyContent: "center", alignItems: "center",
            }}>
              <CheckIcon size={12} color={Colors.textPrimary} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {ep.IndexNumber != null && (
              <View style={{
                backgroundColor: "rgba(139, 92, 246, 0.15)",
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: 4, borderWidth: 1,
                borderColor: "rgba(139, 92, 246, 0.25)",
              }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: "700" }}>
                  E{String(ep.IndexNumber).padStart(2, "0")}
                </Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              style={{
                color: isCurrent ? Colors.accentPurpleLight : Colors.textPrimary,
                fontSize: 16,
                fontFamily: isCurrent ? Fonts.bold : Fonts.semibold,
                flex: 1,
              }}
            >
              {ep.Name}
            </Text>
            {badgeLabel && (
              <View style={{
                backgroundColor: Colors.accentPurple,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
              }}>
                <Text style={{ color: "#fff", fontSize: 11, fontFamily: Fonts.bold }}>
                  {badgeLabel}
                </Text>
              </View>
            )}
          </View>
          {/* Durée + date + qualité/langues — parité EpisodeRow web */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {runtime && (
              <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{runtime}</Text>
            )}
            {dateLabel && (
              <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{dateLabel}</Text>
            )}
            <TVMetaChips item={ep} />
          </View>
          {ep.Overview && (
            <Text
              numberOfLines={2}
              style={{ color: Colors.textMuted, ...Typography.caption, marginTop: 6, lineHeight: 18 }}
            >
              {ep.Overview}
            </Text>
          )}
        </View>
      </View>
    </Focusable>
  );
});
