import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { OPEN_HERO_WATCH, PREVIEW_STAGE_RESHOW_MS, PREVIEW_ZONE_FADE, PREVIEW_ZONE_HINT, previewStageCut } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { useStageShown, type StageRect } from "../cards/trailerPreviewPort";
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
 *
 * Le focus passe à un autre sujet (`subjectKey`) : la vidéo se COUPE (tv-core
 * `previewStageCut`), jamais un fondu de la vidéo de l'ancien sujet au
 * rectangle du nouveau. Le rendu qui le constate garde l'ancien rectangle et
 * éteint la scène par sa valeur animée — à la même image que la face de la
 * surface quittée revient (`useStageSurface`, même émission du magasin) ; le
 * nouveau rectangle ne vient qu'ensuite, masqué. Le fondu de sortie ne vaut
 * que sur place (fin de l'aperçu, erreur).
 */
export const PreviewStage = memo(function PreviewStage({ rect, subjectKey, video, videoShown, remote, onLiveChange }: {
  rect: StageRect | null;
  /** Le sujet dont la scène tient le rectangle (la bannière, une carte). */
  subjectKey: string | null;
  video: ReactNode | null;
  videoShown: boolean;
  remote: { paused: boolean; muted: boolean } | null;
  /** Le sujet dont la vidéo se montre VRAIMENT (coupure comprise) : sa surface s'efface alors. */
  onLiveChange: (key: string | null) => void;
}) {
  const reduced = useReducedMotion();
  // L'opacité de la scène, partagée avec ses surfaces (`useStageShown`) : elles la lisent.
  const shown = useStageShown(0);
  // Le sujet dont la vidéo se montre ; un autre sujet au rectangle : coupure.
  const [liveKey, setLiveKey] = useState<string | null>(null);
  // La coupure appliquée (la scène éteinte) pour ce sujet : le nouveau rectangle peut venir.
  const [cutFor, setCutFor] = useState<string | null>(null);
  // La première vidéo : rien à couper.
  if (videoShown && liveKey === null) setLiveKey(subjectKey);
  const cut = previewStageCut(liveKey, subjectKey);
  const settled = cut && cutFor === subjectKey;
  const liveRect = useRef(rect);
  if (!cut) liveRect.current = rect;
  const cutAt = useRef(0);
  useEffect(() => {
    if (!cut) {
      shown.value = motionTo(videoShown ? 1 : 0, videoShown ? PREVIEW_ZONE_FADE.videoInMs : PREVIEW_ZONE_FADE.videoOutMs, reduced);
      return undefined;
    }
    if (!settled) {
      shown.value = 0;
      cutAt.current = Date.now();
      setCutFor(subjectKey);
      return undefined;
    }
    if (!videoShown) return undefined;
    // Coupée, posée au nouveau rectangle : la vidéo devient celle de ce sujet, en fondu — même
    // la MÊME bande-annonce (la bannière puis la carte du même titre), une fois la carte ouverte.
    const timer = setTimeout(() => setLiveKey(subjectKey), Math.max(0, cutAt.current + PREVIEW_STAGE_RESHOW_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [cut, settled, subjectKey, videoShown, shown, reduced]);
  const live = !cut && videoShown ? liveKey : null;
  useEffect(() => onLiveChange(live), [live, onLiveChange]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  const hint = useZoneHint(remote);
  // Le rendu de la coupure : l'ancien rectangle, qui s'éteint ; ensuite le nouveau, masqué.
  const box = cut && !settled ? liveRect.current : rect;
  if (!box) return null;
  const frame = { left: box.x, top: box.y, width: box.width, height: box.height };
  const mediaWidth = box.mediaWidth ?? box.width;
  const mediaLeft = box.width - mediaWidth;
  return (
    // Au nouveau rectangle, la coupure est AUSSI un style du rendu, sur une vue à part : il n'a
    // jamais l'ancienne vidéo, quel que soit le moment où la valeur animée s'applique.
    <View pointerEvents="none" style={[styles.stage, frame, settled && styles.cut]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, { borderRadius: box.radius }, fade]}>
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: box.radius }]}>
          <View style={[styles.media, { left: mediaLeft, width: mediaWidth }]}>
            <StageCornerContext.Provider value={box.radius}>{video}</StageCornerContext.Provider>
          </View>
          {mediaLeft > 0 ? (
            <View style={[styles.media, { left: mediaLeft, width: OPEN_HERO_WATCH.fadeWidth }]}>
              <SoftGradient width={OPEN_HERO_WATCH.fadeWidth} height={box.height} colors={["#000", "rgba(0,0,0,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
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
    </View>
  );
});

const STATUS_ICON = 24;
const CHIP = 48;
/** Les coins, en retrait du bord du cadre. */
const CORNER = 22;

const styles = StyleSheet.create({
  stage: { position: "absolute" },
  black: { backgroundColor: "#000" },
  clip: { overflow: "hidden" },
  cut: { opacity: 0 },
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
