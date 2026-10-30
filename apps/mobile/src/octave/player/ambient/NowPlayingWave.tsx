/**
 * Octave (mobile) — la VAGUE du lecteur plein écran : trois lignes fines au dégradé de la marque, posées en bas
 * du fond, sous les commandes, avec un voile de couleur sous la première. Elle roule au rythme du son RÉEL
 * (`useEngineWave` : vitesse et hauteur de fond par l'énergie, crête par l'impulsion) ; sans mesure, une houle
 * calme qui ne prétend suivre aucun rythme (`WAVE_CALM`).
 *
 * Coût : le tracé (49 points par ligne) est calculé sur le fil d'interface (`wavePath`, fonction de travail), et
 * seule la propriété `d` des chemins change — aucun rendu React par image. L'horloge (`useFrameCallback`) ne
 * tourne que si `running` (lecteur ouvert, app au premier plan, lecture, sans mouvement réduit) : sinon la vague
 * se fige où elle est ; sous mouvement réduit, elle reste une ligne posée, immobile.
 */

import { memo, useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useOctaveColors } from "../../theme/octaveColors";
import type { EngineWave } from "./useEngineWave";
import { WAVE_LINES, waveMotion, wavePath } from "./waveDrive";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** La hauteur de la bande (pt) et sa place : collée au bas de l'écran, derrière la rangée d'actions. */
export const WAVE_BAND_HEIGHT = 150;
const LINE_OPACITY = [0.55, 0.34, 0.2] as const;
const LINE_WIDTH = [2, 1.5, 1] as const;
const VEIL_OPACITY = 0.1;
/** La phase est ramenée dans [0, 2π·FOLD[ : aucune perte de précision au bout d'une longue écoute. */
const PHASE_FOLD = 2 * Math.PI * 1000;

interface Props {
  wave: EngineWave;
  running: boolean;
}

export const NowPlayingWave = memo(function NowPlayingWave({ wave, running }: Props) {
  const colors = useOctaveColors();
  const { width } = useWindowDimensions();
  const phase = useSharedValue(0);
  const { energy, punch, measured } = wave;
  const clock = useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const motion = waveMotion(energy.value, punch.value, measured.value);
    phase.value = (phase.value + dt * motion.speed) % PHASE_FOLD;
  }, false);
  useEffect(() => {
    clock.setActive(running);
  }, [clock, running]);

  return (
    <View style={styles.band} pointerEvents="none">
      <Svg width={width} height={WAVE_BAND_HEIGHT}>
        <Defs>
          <LinearGradient id="octaveWave" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.gradient[0]} />
            <Stop offset="0.5" stopColor={colors.gradient[1]} />
            <Stop offset="1" stopColor={colors.gradient[2]} />
          </LinearGradient>
        </Defs>
        <WaveLine index={0} width={width} phase={phase} wave={wave} closed />
        {WAVE_LINES.map((_, i) => (
          <WaveLine key={i} index={i} width={width} phase={phase} wave={wave} closed={false} />
        ))}
      </Svg>
    </View>
  );
});

interface LineProps {
  index: number;
  width: number;
  phase: SharedValue<number>;
  wave: EngineWave;
  closed: boolean;
}

const WaveLine = memo(function WaveLine({ index, width, phase, wave, closed }: LineProps) {
  const line = WAVE_LINES[index] ?? WAVE_LINES[0];
  const { energy, punch, measured } = wave;
  const props = useAnimatedProps(() => {
    const motion = waveMotion(energy.value, punch.value, measured.value);
    return { d: wavePath(width, WAVE_BAND_HEIGHT, phase.value, motion.height * line.scale, line.cycles, line.offset, closed) };
  }, [width, line, closed]);
  return closed ? (
    <AnimatedPath animatedProps={props} fill="url(#octaveWave)" fillOpacity={VEIL_OPACITY} />
  ) : (
    <AnimatedPath
      animatedProps={props}
      fill="none"
      stroke="url(#octaveWave)"
      strokeOpacity={LINE_OPACITY[index]}
      strokeWidth={LINE_WIDTH[index]}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
});

const styles = StyleSheet.create({
  band: { position: "absolute", left: 0, right: 0, bottom: 0, height: WAVE_BAND_HEIGHT },
});
