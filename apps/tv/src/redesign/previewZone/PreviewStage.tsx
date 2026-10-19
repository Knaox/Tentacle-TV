import { memo, useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { OPEN_HERO_WATCH, PREVIEW_ZONE_FADE, PREVIEW_ZONE_HINT } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import type { StageRect } from "../cards/trailerPreviewPort";
import { Icon } from "../icons/Icon";
import { motionTo } from "../motion/motion";
import { Reveal } from "../motion/Reveal";
import { colors } from "../theme/tokens";
import { useZoneHint } from "./useZoneHint";
import { StageCornerContext } from "./stageCorner";
import { ZONE_HINT_PILL } from "./zoneModel";
import { ZoneRemoteHint } from "./ZoneRemoteHint";

/**
 * La SCÈNE d'une page à cartes qui s'ouvrent (Apple TV, Android TV) : le
 * lecteur UNIQUE de la page, posé DERRIÈRE elle — au rectangle de la carte
 * ouverte (toujours le même : la carte focalisée se pose au bord gauche, sa
 * rangée sous l'ancrage) ou de la bannière focalisée. Pendant l'aperçu, la
 * carte (ou la bannière) devient transparente et la vidéo se voit à travers :
 * RIEN ne dessine par-dessus une cible — tvOS ne focalise jamais un élément
 * recouvert (le PiP flottant du 19/10 l'avait appris à ses dépens).
 *
 * La vidéo remplit le cadre, sauf là où il dit sa largeur (`mediaWidth` : la
 * bannière) : elle y est ENTIÈRE, en 16:9, calée à droite et fondue vers le
 * noir sur sa gauche — la bannière écrit son texte dans le noir.
 *
 * Dans ses coins (ceux de la vidéo), l'état : les raccourcis en bas à gauche (au départ, à chaque
 * geste, toujours en pause : `useZoneHint`), les pictos pause et muet en bas à
 * droite tant que l'état dure. Rien de focalisable ; seules les opacités
 * s'animent, et le cadre change de place sans remonter le lecteur.
 */
export const PreviewStage = memo(function PreviewStage({ rect, video, videoShown, remote }: {
  rect: StageRect | null;
  video: ReactNode | null;
  videoShown: boolean;
  remote: { paused: boolean; muted: boolean } | null;
}) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = motionTo(videoShown ? 1 : 0, videoShown ? PREVIEW_ZONE_FADE.videoInMs : PREVIEW_ZONE_FADE.videoOutMs, reduced);
  }, [videoShown, shown, reduced]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  const hint = useZoneHint(remote);
  if (!rect) return null;
  const frame = { left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: rect.radius };
  const mediaWidth = rect.mediaWidth ?? rect.width;
  const mediaLeft = rect.width - mediaWidth;
  return (
    <Animated.View pointerEvents="none" style={[styles.stage, frame, fade]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: rect.radius }]}>
        <View style={[styles.media, { left: mediaLeft, width: mediaWidth }]}>
          <StageCornerContext.Provider value={rect.radius}>{video}</StageCornerContext.Provider>
        </View>
        {mediaLeft > 0 ? (
          <View style={[styles.media, { left: mediaLeft, width: OPEN_HERO_WATCH.fadeWidth }]}>
            <SoftGradient width={OPEN_HERO_WATCH.fadeWidth} height={rect.height} colors={["#000", "rgba(0,0,0,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
          </View>
        ) : null}
      </View>
      <Reveal shown={hint?.shown ?? false} motion={PREVIEW_ZONE_HINT.fadeOutMs} style={[styles.hint, { left: mediaLeft + CORNER }]}>
        {hint ? <View style={ZONE_HINT_PILL}><ZoneRemoteHint paused={hint.paused} muted={hint.muted} /></View> : null}
      </Reveal>
      <View style={styles.status}>
        <Reveal shown={hint?.paused ?? false}>
          <View style={styles.chip}><Icon name="pause" size={STATUS_ICON} color={colors.text} /></View>
        </Reveal>
        <Reveal shown={hint?.muted ?? false}>
          <View style={styles.chip}><Icon name="muted" size={STATUS_ICON} color={colors.text} strokeWidth={2} /></View>
        </Reveal>
      </View>
    </Animated.View>
  );
});

const STATUS_ICON = 24;
const CHIP = 48;
/** Les coins, en retrait du bord du cadre. */
const CORNER = 22;

const styles = StyleSheet.create({
  stage: { position: "absolute", backgroundColor: "#000" },
  clip: { overflow: "hidden" },
  media: { position: "absolute", top: 0, bottom: 0 },
  hint: { position: "absolute", bottom: CORNER },
  status: { position: "absolute", right: CORNER, bottom: CORNER, flexDirection: "row", gap: 12 },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    backgroundColor: ZONE_HINT_PILL.backgroundColor,
    alignItems: "center",
    justifyContent: "center",
  },
});
