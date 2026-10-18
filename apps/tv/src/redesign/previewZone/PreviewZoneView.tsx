import { memo, useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { motionTo } from "../motion/motion";
import { Reveal } from "../motion/Reveal";
import { scrim } from "../theme/tokens";
import { ZoneBackdrop } from "./ZoneBackdrop";
import { ZoneRemoteHint } from "./ZoneRemoteHint";
import { ZoneText } from "./ZoneText";
import { ZONE, type PreviewZoneModel } from "./zoneModel";

/**
 * La ZONE D'APERÇU (Apple TV, Android TV) : en haut de la page, toujours au
 * même endroit, façon Netflix au salon — le fond du titre focalisé en haut à
 * droite, fondu vers le noir à gauche et en bas (il déborde sous la zone,
 * sous la première rangée), sa bande-annonce qui entre en fondu sur le fond à
 * sa première image, et à gauche son logo, ses métadonnées, son synopsis.
 *
 * Un CALQUE DE FOND, rien de focalisable (`pointerEvents="none"`) : la page
 * le pose en premier (`BelowZonePage`), ses rangées dessinent par-dessus, et
 * le focus n'y passe jamais — la zone suit la navigation, elle ne la retient
 * pas. Seules les opacités s'animent : changer de carte ne remet rien en page.
 *
 * `video` : le lecteur unique de la zone, fourni par l'intégration — monté
 * une fois, sa source change d'un titre à l'autre ; `videoShown` : sa première
 * image est là, au délai de l'utilisateur. `remote` : l'aperçu joue sous le
 * focus — ce que Lecture/Pause en fait, dit en bas à droite.
 */

export interface PreviewZoneViewProps {
  model: PreviewZoneModel | null;
  /** Le héros de l'Accueil a la zone : le texte laisse la place de ses boutons. */
  heroRoom: boolean;
  video: ReactNode | null;
  videoShown: boolean;
  remote: { paused: boolean; muted: boolean } | null;
}

const { width: MEDIA_W, height: MEDIA_H } = ZONE.media;

export const PreviewZoneView = memo(function PreviewZoneView({ model, heroRoom, video, videoShown, remote }: PreviewZoneViewProps) {
  const reduced = useReducedMotion();
  const videoOpacity = useSharedValue(0);
  useEffect(() => {
    videoOpacity.value = motionTo(videoShown ? 1 : 0, videoShown ? PREVIEW_ZONE_FADE.videoInMs : PREVIEW_ZONE_FADE.videoOutMs, reduced);
  }, [videoShown, videoOpacity, reduced]);
  const videoFade = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));
  // L'indice garde ses mots le temps de sa sortie.
  const lastRemote = useRef(remote);
  if (remote) lastRemote.current = remote;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.media}>
        <ZoneBackdrop uri={model?.backdropUri ?? null} />
        <Animated.View style={[StyleSheet.absoluteFill, videoFade]}>{video}</Animated.View>
        {/* Vers le noir à gauche (le texte s'y lit), puis en bas, sous la première rangée. */}
        <SoftGradient
          width={MEDIA_W}
          height={MEDIA_H}
          colors={[scrim(1), scrim(0.72), scrim(0)]}
          locations={[0, 0.24, 0.62]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(0), scrim(0.6), scrim(1)]} locations={[0.36, 0.62, 1]} />
      </View>
      {model ? <ZoneText model={model} heroRoom={heroRoom} /> : null}
      <Reveal shown={remote !== null} style={styles.hint}>
        {lastRemote.current ? <ZoneRemoteHint paused={lastRemote.current.paused} muted={lastRemote.current.muted} /> : null}
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  media: { position: "absolute", top: 0, right: 0, width: MEDIA_W, height: MEDIA_H, overflow: "hidden" },
  hint: { position: "absolute", right: ZONE.right, top: ZONE.height - ZONE.bottom - 26 },
});
