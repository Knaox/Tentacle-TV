import { memo, useEffect, useMemo } from "react";
import { View, Text, Image, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { SpeedPill } from "./SpeedPill";
import type { UseTVTrickplayResult } from "../../hooks/useTVTrickplay";
import { Colors } from "../../theme/colors";

interface TVScrubFullscreenProps {
  /** Position du curseur fantôme (s). */
  scrubPosition: number;
  /** Position réelle de lecture figée (s) → delta ± et point sur la barre. */
  currentTime: number;
  duration: number;
  speedLabel?: string | null;
  trickplay?: UseTVTrickplayResult;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Prévisualisation de scrub PLEIN ÉCRAN façon Netflix : l'image trickplay de la
 * position cible remplit l'écran (contain, fond noir), timecode + delta + barre
 * en bas, hints OK/Retour discrets. Montée par TVPlayerView quand `scrubbing`,
 * AU-DESSUS de l'OSD (qui reste monté dessous : boutons FF/RW tenus + verrou
 * focus intacts). `pointerEvents="none"`, AUCUN focusable — les entrées restent
 * pilotées par useTVPlayerControls. Sans trickplay : gros timecode centré.
 */
function TVScrubFullscreenImpl({
  scrubPosition, currentTime, duration, speedLabel, trickplay,
}: TVScrubFullscreenProps) {
  const { t } = useTranslation("player");
  const { width: sw, height: sh } = useWindowDimensions();

  // Tuiles haute résolution si le serveur en propose, sinon sélection standard.
  const tp = trickplay?.hiRes ?? trickplay;
  const frame = useMemo(
    () => (tp ? tp.getFrameAt(scrubPosition * 1000) : null),
    [tp, scrubPosition],
  );
  const info = tp?.info ?? null;
  const hasFrame = frame !== null && info !== null;

  // Préchargement agressif des mosaïques voisines (scrub rapide → tuiles prêtes).
  useEffect(() => {
    if (frame && tp) tp.preloadNeighbors(frame.tileIndex, 2);
  }, [frame, tp]);

  // Crop de la mosaïque agrandi à l'écran entier (contain, centré).
  const scale = hasFrame ? Math.min(sw / info.Width, sh / info.Height) : 1;
  const frameW = hasFrame ? Math.round(info.Width * scale) : 0;
  const frameH = hasFrame ? Math.round(info.Height * scale) : 0;
  const mosaicW = hasFrame ? Math.round(info.Width * info.TileWidth * scale) : 0;
  const mosaicH = hasFrame ? Math.round(info.Height * info.TileHeight * scale) : 0;
  const offsetX = hasFrame ? -Math.round(frame.xInTile * scale) : 0;
  const offsetY = hasFrame ? -Math.round(frame.yInTile * scale) : 0;

  const progressPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const scrubPct = duration > 0 ? Math.min((scrubPosition / duration) * 100, 100) : 0;
  const delta = Math.round(scrubPosition - currentTime);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: hasFrame ? "#000" : "rgba(0,0,0,0.92)",
        alignItems: "center", justifyContent: "center",
      }}
    >
      {hasFrame && (
        <View style={{ width: frameW, height: frameH, overflow: "hidden", backgroundColor: "#000" }}>
          <Image
            source={{ uri: frame.url }}
            style={{ position: "absolute", left: offsetX, top: offsetY, width: mosaicW, height: mosaicH }}
            resizeMode="stretch"
            fadeDuration={0}
          />
        </View>
      )}

      <SpeedPill label={speedLabel ?? null} />

      {/* Chrome bas : timecode cible + delta, barre, hints */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          paddingHorizontal: 48, paddingBottom: 44, paddingTop: 110,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 18, marginBottom: 22 }}>
          <Text style={{
            color: Colors.textPrimary, fontSize: 46, fontWeight: "800",
            fontVariant: ["tabular-nums"], letterSpacing: 1,
          }}>
            {formatTime(scrubPosition)}
          </Text>
          {delta !== 0 && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999,
              paddingHorizontal: 14, paddingVertical: 5, marginBottom: 9,
            }}>
              <Text style={{
                color: Colors.textPrimary, fontSize: 19, fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}>
                {`${delta > 0 ? "+" : "−"}${formatTime(Math.abs(delta))}`}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{
            color: Colors.textSecondary, fontSize: 15, fontWeight: "500", width: 76,
            fontVariant: ["tabular-nums"],
          }}>
            {formatTime(currentTime)}
          </Text>
          <View style={{ flex: 1, marginHorizontal: 16 }}>
            <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 3, overflow: "hidden" }}>
              <View style={{
                height: 5, width: `${progressPct}%`,
                backgroundColor: Colors.accentPurple, borderRadius: 3,
              }} />
            </View>
            {/* Point de lecture réelle */}
            <View style={{
              position: "absolute", top: -3, left: `${progressPct}%`, marginLeft: -5,
              width: 11, height: 11, borderRadius: 6,
              backgroundColor: Colors.accentPurple,
            }} />
            {/* Curseur fantôme — position cible */}
            <View style={{
              position: "absolute", top: -6, left: `${scrubPct}%`, marginLeft: -8,
              width: 17, height: 17, borderRadius: 9,
              backgroundColor: Colors.textPrimary,
              borderWidth: 2, borderColor: Colors.accentPurple,
            }} />
          </View>
          <Text style={{
            color: Colors.textSecondary, fontSize: 15, fontWeight: "500",
            width: 76, textAlign: "right", fontVariant: ["tabular-nums"],
          }}>
            {formatTime(duration)}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" }}>
            {t("scrubConfirmHint")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" }}>
            {t("scrubCancelHint")}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export const TVScrubFullscreen = memo(TVScrubFullscreenImpl);
