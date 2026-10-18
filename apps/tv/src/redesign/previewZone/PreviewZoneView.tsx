import { memo, useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, previewZoneVeilStops, previewZoneWatching, previewZoneWatchingMs } from "@tentacle-tv/tv-core";
import { SoftGradient, STAGE_SIZE } from "../background/SoftGradient";
import { motionTo } from "../motion/motion";
import { scrim } from "../theme/tokens";
import { ZoneBackdrop } from "./ZoneBackdrop";
import { ZoneText } from "./ZoneText";
import { useZoneHint } from "./useZoneHint";
import { ZONE, type PreviewZoneModel } from "./zoneModel";

/**
 * La ZONE D'APERÇU (Apple TV, Android TV) : en haut de la page, toujours au
 * même endroit, façon Netflix au salon — le fond du titre focalisé en haut à
 * droite, TOUT ENTIER dans la zone (tv-core `PREVIEW_ZONE_MEDIA` : rien de la
 * page ne passe dessus), fondu vers le noir à gauche et en bas, sa
 * bande-annonce qui entre en fondu sur le fond à sa première image, et à
 * gauche son logo, ses métadonnées, son synopsis.
 *
 * Un CALQUE DE FOND, rien de focalisable (`pointerEvents="none"`) : la page
 * le pose en premier (`BelowZonePage`), ses rangées dessinent par-dessus, et
 * le focus n'y passe jamais — la zone suit la navigation, elle ne la retient
 * pas. Seules les opacités s'animent : changer de carte ne remet rien en page.
 *
 * `video` : le lecteur unique de la zone, fourni par l'intégration — monté
 * une fois, sa source change d'un titre à l'autre ; `videoShown` : sa première
 * image est là, au délai de l'utilisateur. `remote` : l'aperçu joue sous le
 * focus — ce que Lecture/Pause en fait, dit dans la colonne de gauche, au
 * départ puis à chaque geste (`useZoneHint`), jamais sur l'image.
 *
 * Quand la vidéo se montre (tv-core `previewZoneWatching`), le texte passe à
 * sa version allégée mais remplie, à gauche de la vidéo (`ZoneWatchText`), et
 * les voiles vers le noir à gauche et en bas ne gardent que leur raccord —
 * chaque voile est en deux calques, un LÉGER toujours posé (le raccord au
 * noir, aucune arête) et le PLEIN du repos par-dessus, dont seule l'opacité
 * baisse.
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
const VEIL_STOPS = previewZoneVeilStops(MEDIA_H);
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
  const watching = previewZoneWatching({ videoShown });
  const watch = useSharedValue(0);
  useEffect(() => {
    watch.value = motionTo(watching ? 1 : 0, previewZoneWatchingMs(watching), reduced);
  }, [watching, watch, reduced]);
  const restScrim = useAnimatedStyle(() => ({ opacity: 1 - watch.value }));
  const hint = useZoneHint(remote);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Le haut de la scène en NOIR, sur toute la largeur, PLEIN jusqu'au bas du fond et de la vidéo
          (qui finissent en noir opaque), puis effacé vers le fond de la page : la lumière de la page
          ne longe jamais leur bord gauche ni leur bas (tv-core `previewZoneVeilStops`). */}
      <SoftGradient width={STAGE_SIZE.width} height={STAGE_SIZE.height} colors={[scrim(1), scrim(1), scrim(0)]} locations={VEIL_STOPS} />
      <View style={styles.media}>
        <ZoneBackdrop uri={model?.backdropUri ?? null} />
        <Animated.View style={[StyleSheet.absoluteFill, videoFade]}>{video}</Animated.View>
        {/* Le haut vers le noir : la bande noire d'une bande-annonce LETTERBOXÉE (incrustée dans le
            fichier, « cover » n'en rogne pas toujours tout) s'y fond, comme le haut de la scène. */}
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0)]} locations={[0, 0.14]} />
        {/* Les raccords, toujours là : le bord gauche fondu au noir (là où le texte se pose), le bas
            fini au noir AU bord de la zone — la page commence sur le noir du voile, sans arête. */}
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0.4), scrim(0)]} locations={[0, 0.1, 0.3]} start={H_START} end={H_END} />
        <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(0), scrim(0.55), scrim(1)]} locations={[0.6, 0.86, 1]} />
        {/* Les voiles pleins du repos, par-dessus — vers le noir à gauche (le texte s'y lit), puis en bas :
            ils s'effacent pendant que la vidéo se montre. */}
        <Animated.View style={[StyleSheet.absoluteFill, restScrim]}>
          <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(1), scrim(0.72), scrim(0)]} locations={[0, 0.24, 0.62]} start={H_START} end={H_END} />
          <SoftGradient width={MEDIA_W} height={MEDIA_H} colors={[scrim(0), scrim(0.6), scrim(1)]} locations={[0.36, 0.72, 1]} />
        </Animated.View>
      </View>
      {model ? <ZoneText model={model} heroRoom={heroRoom} watch={watch} hint={hint} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  media: { position: "absolute", top: 0, right: 0, width: MEDIA_W, height: MEDIA_H, overflow: "hidden" },
});
