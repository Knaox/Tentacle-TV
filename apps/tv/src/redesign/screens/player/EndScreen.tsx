import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import { BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { TitleArt } from "../../hero/TitleArt";
import { useOverlayArrival } from "../../motion/useOverlayArrival";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { CountdownPill } from "./CountdownPill";
import type { EndScreenModel, PlayerLabels } from "./playerTypes";

/**
 * L'affiche de la VRAIE fin d'un épisode, plein écran : le fond de la série
 * assombri, à gauche ce qui suit (le décompte, le logo de la série, le code
 * et le titre de l'épisode, son résumé) et « Lire maintenant » (anneau du
 * décompte) ; à droite, l'image de l'épisode suivant dans sa lumière. La
 * refuser sort du lecteur : la croix Retour, en haut à gauche comme partout.
 * Clés : `end:play`, `end:leave` (la croix) ; groupes `end:actions` et
 * `end:screen` — l'écran entier, croix comprise, où l'intégration retient le
 * focus.
 */

const SAFE = TV_STAGE.safe;
const STILL = { width: 720, height: 405, radius: 32 };

export const EndScreen = memo(function EndScreen({
  model,
  labels,
  onPlayNext,
  onLeave,
}: {
  model: EndScreenModel;
  labels: Pick<PlayerLabels, "upNext" | "playNow">;
  onPlayNext?: () => void;
  onLeave?: () => void;
}) {
  // L'affiche de fin arrive comme une page : en fondu, son texte montant de
  // quelques points (Apple TV).
  const { body } = useOverlayArrival("y", 16, "page");
  return (
    <Animated.View style={[styles.root, body]}>
      <FocusGroup focusKey="end:screen" style={StyleSheet.absoluteFill}>
        {model.backdropUri ? <Image source={{ uri: model.backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
        <SoftGradient
          {...STAGE_SIZE}
          colors={[scrim(0.95), scrim(0.84), scrim(0.5)]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        <SoftGradient {...STAGE_SIZE} colors={[scrim(0), scrim(0.75)]} locations={[0.55, 1]} />
        <View style={styles.column}>
          <View style={styles.kickerRow}>
            <View style={styles.dot} />
            <Text style={styles.kicker} numberOfLines={1}>{model.countdownLabel ?? labels.upNext}</Text>
          </View>
          <TitleArt title={model.seriesTitle} logoUri={model.logoUri} maxWidth={560} maxHeight={120} fontSize={64} />
          <View style={styles.episode}>
            {model.code ? <Text style={styles.code}>{model.code}</Text> : null}
            <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
          </View>
          {model.overview ? <Text style={styles.overview} numberOfLines={3}>{model.overview}</Text> : null}
          <FocusGroup focusKey="end:actions" style={styles.actions}>
            <CountdownPill variant="brand" icon="play" label={labels.playNow} countdown={model.countdown} focusKey="end:play" onPress={onPlayNext} />
          </FocusGroup>
        </View>
        <View style={styles.still} pointerEvents="none">
          {model.palette ? <ArtworkHalo width={STILL.width} height={STILL.height} radius={STILL.radius} palette={model.palette} opacity={0.3} /> : null}
          <View style={styles.frame}>
            {model.imageUri ? <Image source={{ uri: model.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
            <View style={[StyleSheet.absoluteFill, styles.ring]} />
          </View>
        </View>
        <View style={styles.back}>
          <BackButton focusKey="end:leave" onPress={onLeave} />
        </View>
      </FocusGroup>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  column: { position: "absolute", left: SAFE.x, top: 0, bottom: 0, width: 1920 - SAFE.x * 2 - STILL.width - 90, justifyContent: "center", gap: 26 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  kicker: { ...fonts.bold, fontSize: 28, color: colors.accentLight },
  episode: { gap: 8 },
  code: { ...fonts.semibold, fontSize: 28, color: white(0.7) },
  title: { ...fonts.extrabold, fontSize: 52, lineHeight: 60, letterSpacing: -0.8, color: colors.text },
  overview: { ...fonts.regular, fontSize: 27, lineHeight: 38, color: white(0.8), maxWidth: 820 },
  actions: { flexDirection: "row", gap: 18, marginTop: 10 },
  // Au-dessus de la colonne : HAUT depuis « Lire maintenant » y monte (alignés).
  back: { position: "absolute", top: BACK_TOP, left: SAFE.x },
  still: { position: "absolute", right: SAFE.x, top: (1080 - STILL.height) / 2, width: STILL.width, height: STILL.height },
  frame: { width: STILL.width, height: STILL.height, borderRadius: STILL.radius, overflow: "hidden", backgroundColor: colors.surface3 },
  ring: { borderRadius: STILL.radius, borderWidth: 1, borderColor: white(0.16) },
});
