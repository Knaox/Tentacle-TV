import { memo, useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, previewZoneWatching, previewZoneWatchingMs } from "@tentacle-tv/tv-core";
import { SoftGradient, STAGE_SIZE } from "../background/SoftGradient";
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
 *
 * Quand la vidéo JOUE (tv-core `previewZoneWatching`), la zone s'efface devant
 * elle : le texte se retire (le logo reste, réduit), et les voiles vers le
 * noir à gauche et en bas ne gardent que leur raccord — chaque voile est en
 * deux calques, un LÉGER toujours posé (le raccord au noir, aucune arête) et
 * le PLEIN du repos par-dessus, dont seule l'opacité baisse.
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
/** La hauteur d'un indice dans sa pastille (`ZoneRemoteHint` : une ligne de 26, 7 de marge en haut et en bas). */
const HINT_HEIGHT = 26 + 2 * 7;
const H_START = { x: 0, y: 0.5 };
const H_END = { x: 1, y: 0.5 };

export const PreviewZoneView = memo(function PreviewZoneView({ model, heroRoom, video, videoShown, remote }: PreviewZoneViewProps) {
  const reduced = useReducedMotion();
  const videoOpacity = useSharedValue(0);
  useEffect(() => {
    videoOpacity.value = motionTo(videoShown ? 1 : 0, videoShown ? PREVIEW_ZONE_FADE.videoInMs : PREVIEW_ZONE_FADE.videoOutMs, reduced);
  }, [videoShown, videoOpacity, reduced]);
  const videoFade = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));
  // 0 au repos, 1 quand la vidéo joue : le texte se retire, les voiles s'allègent.
  const watching = previewZoneWatching({ videoShown, paused: remote?.paused ?? false });
  const watch = useSharedValue(0);
  useEffect(() => {
    watch.value = motionTo(watching ? 1 : 0, previewZoneWatchingMs(watching), reduced);
  }, [watching, watch, reduced]);
  const restScrim = useAnimatedStyle(() => ({ opacity: 1 - watch.value }));
  // L'indice garde ses mots le temps de sa sortie.
  const lastRemote = useRef(remote);
  if (remote) lastRemote.current = remote;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Le haut de la scène en NOIR, sur toute la largeur, qui s'efface vers le bas sur le fond de la
          page : le fondu du fond et de la vidéo y aboutit sans arête (ni à gauche du fond, ni sous lui). */}
      <SoftGradient width={STAGE_SIZE.width} height={STAGE_SIZE.height} colors={[scrim(1), scrim(1), scrim(0)]} locations={[0, 0.5, 0.86]} />
      <View style={styles.media}>
        <ZoneBackdrop uri={model?.backdropUri ?? null} />
        <Animated.View style={[StyleSheet.absoluteFill, videoFade]}>{video}</Animated.View>
        {/* Le haut vers le noir : la bande noire d'une bande-annonce LETTERBOXÉE (incrustée dans le
            fichier, « cover » n'y peut rien) s'y fond, comme le haut de la scène. */}
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0)]} locations={[0, 0.2]} />
        {/* Les raccords, toujours là : le bord gauche fondu au noir (là où le texte et le logo se posent),
            le bas fini au noir AVANT le bord (vers 640), là où le voile de la scène est encore presque plein. */}
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0.4), scrim(0)]} locations={[0, 0.1, 0.3]} start={H_START} end={H_END} />
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(0), scrim(0.55), scrim(1)]} locations={[0.46, 0.66, 0.88]} />
        {/* Les voiles pleins du repos, par-dessus — vers le noir à gauche (le texte s'y lit), puis en bas,
            sous la première rangée : ils s'effacent pendant que la vidéo joue. */}
        <Animated.View style={[StyleSheet.absoluteFill, restScrim]}>
          <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0.72), scrim(0)]} locations={[0, 0.24, 0.62]} start={H_START} end={H_END} />
          <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(0), scrim(0.6), scrim(1)]} locations={[0.34, 0.6, 0.88]} />
        </Animated.View>
      </View>
      {model ? <ZoneText model={model} heroRoom={heroRoom} watch={watch} /> : null}
      {/* En bas à droite ; sous le héros, sur la ligne AU-DESSUS de ses boutons (ses points de rotation
          et « Maintenir OK » occupent la leur). */}
      <Reveal shown={remote !== null} style={[styles.hint, heroRoom && styles.hintOverHero]}>
        {lastRemote.current ? <ZoneRemoteHint paused={lastRemote.current.paused} muted={lastRemote.current.muted} /> : null}
      </Reveal>
    </View>
  );
});

const styles = StyleSheet.create({
  media: { position: "absolute", top: 0, right: 0, width: MEDIA_W, height: MEDIA_H, overflow: "hidden" },
  // Sur la ligne du bas de la zone — celle des boutons du héros, centrée sur eux : « Maintenir OK »
  // (à droite des boutons) et Lecture/Pause (à droite de la zone) ne font qu'une ligne.
  hint: { position: "absolute", right: ZONE.right, bottom: ZONE.bottom + (ZONE.heroActions - HINT_HEIGHT) / 2 },
  hintOverHero: { bottom: ZONE.bottom + ZONE.heroActions + ZONE.heroActionsGap },
});
