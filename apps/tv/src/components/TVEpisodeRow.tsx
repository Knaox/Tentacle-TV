import { memo, useCallback, useRef } from "react";
import { View, Text, Image } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { Focusable } from "./focus/Focusable";
import { useTvFocusClaim } from "../hooks/useTvFocusClaim";
import { CheckIcon } from "./icons/TVIcons";
import { TVMetaChips } from "./TVMetaChips";
import { Colors, Typography, Fonts, Radius, CardConfig, brandAlpha } from "../theme/colors";

/** Retrait vertical d'une ligne : avec la vignette 16:9, il en fait la hauteur. */
const ROW_PADDING_V = 14;

/** L'écart entre deux lignes. */
export const EPISODE_ROW_GAP = 8;

/**
 * La hauteur EXACTE d'une ligne, dérivée de sa vignette.
 *
 * Elle était estimée — 170 points pour toutes — alors qu'une ligne du lecteur
 * en fait 118. Ouvrir le panneau sur l'épisode 58 faisait donc défiler de
 * cinquante-huit fois l'écart, le focus se posait 2 500 points AU-DESSUS de
 * l'écran, et le premier appui rattrapait tout d'un coup : la liste « défilait
 * énormément ». La ligne a maintenant une hauteur imposée, que la
 * virtualisation et le défilement calculent au point près.
 */
export function episodeRowHeight(thumbWidth: number): number {
  return Math.round((thumbWidth * 9) / 16) + ROW_PADDING_V * 2;
}

interface TVEpisodeRowProps {
  episode: MediaItem;
  index: number;
  thumbUrl: string;
  isCurrent: boolean;
  /** Badge violet « Reprendre » / « À suivre » / « Épisode actuel » (null = pas de badge) */
  badgeLabel: string | null;
  /** Cette ligne RÉCLAME le focus à son montage (épisode en cours, première
   *  ligne d'une saison qu'on vient de choisir). */
  claimFocus?: boolean;
  /** Incrémenter pour réclamer de nouveau sans remonter la ligne. */
  claimNonce?: number;
  /** Largeur de la vignette 16:9 — 200 sur la fiche, 160 dans le panneau du
   *  lecteur (parité `.panneau-tv .aspect-video`). */
  thumbWidth: number;
  onPress: (episode: MediaItem) => void;
  onFocusIndex?: (index: number) => void;
}

/**
 * Ligne épisode (vignette 16:9 + infos) — miroir de EpisodeRow (web) : durée,
 * date de diffusion, pastilles qualité/langues, épisode courant surligné.
 *
 * **Le focus est un anneau, comme une carte.** La ligne se remplissait d'un
 * voile clair au focus — la grammaire des entrées du rail —, que rien ne
 * distinguait du surlignage de l'épisode en cours : on ne voyait pas où l'on
 * était. La LG entoure la ligne de son anneau blanc et de son halo de marque ;
 * c'est la variante « carte », sans agrandissement (une ligne pleine largeur
 * qui grandit déborde de son panneau).
 *
 * Mémoïsée, avec des rappels qui reçoivent l'épisode et l'index : la liste
 * leur passe des fonctions STABLES, et seules les lignes dont les données
 * changent se redessinent.
 */
export const TVEpisodeRow = memo(function TVEpisodeRow({
  episode: ep, index, thumbUrl, isCurrent, badgeLabel, claimFocus, claimNonce = 0,
  thumbWidth, onPress, onFocusIndex,
}: TVEpisodeRowProps) {
  /**
   * La réclamation partagée fait le geste juste sur chaque plateforme (cycle
   * false→true sur tvOS, pose directe sur Android) et RELÂCHE la préférence
   * derrière elle : une préférence qui ne retombe jamais ramène la sélection
   * à chaque occasion, et la liste ne se parcourt plus.
   */
  const rowRef = useRef<View>(null);
  useTvFocusClaim(rowRef, !!claimFocus, claimNonce);

  const handlePress = useCallback(() => onPress(ep), [onPress, ep]);
  const handleFocus = useCallback(() => onFocusIndex?.(index), [onFocusIndex, index]);

  const progress = ep.UserData?.PlayedPercentage ?? 0;
  const isWatched = ep.UserData?.Played === true;
  const runtime = ep.RunTimeTicks ? formatDuration(ep.RunTimeTicks) : null;
  const premiereDate = ep.PremiereDate ? new Date(ep.PremiereDate) : null;
  const dateLabel = premiereDate && !isNaN(premiereDate.getTime())
    ? premiereDate.toLocaleDateString()
    : null;

  return (
    <Focusable
      ref={rowRef}
      variant="card"
      scaleOverride={1}
      glowOverride={0}
      focusRadius={Radius.card}
      onPress={handlePress}
      onFocus={handleFocus}
      accessibilityLabel={ep.Name}
    >
      <View style={{
        height: episodeRowHeight(thumbWidth),
        flexDirection: "row", alignItems: "center", gap: 20,
        paddingHorizontal: 16,
        borderRadius: Radius.card,
        overflow: "hidden",
        backgroundColor: isCurrent ? brandAlpha(0.14) : "rgba(255,255,255,0.04)",
        borderWidth: isCurrent ? 1 : 0,
        borderColor: isCurrent ? brandAlpha(0.45) : "transparent",
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
                backgroundColor: brandAlpha(0.15),
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: 4, borderWidth: 1,
                borderColor: brandAlpha(0.25),
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
          {/* Durée + date + qualité/langues — parité EpisodeRow web. Une seule
              ligne : la hauteur de la case est imposée. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, overflow: "hidden" }}>
            {runtime && (
              <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{runtime}</Text>
            )}
            {dateLabel && (
              <Text style={{ color: Colors.textTertiary, ...Typography.caption }}>{dateLabel}</Text>
            )}
            <TVMetaChips item={ep} wrap={false} />
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
