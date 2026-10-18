import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { SPARKLES, sparkleCenter, type IntroGeometry } from "@tentacle-tv/shared/brandIntro";
import { INTRO_PLATES, type IntroHoldSamples, type IntroSamples } from "@tentacle-tv/tv-core/boot";
import type { PartBoxes, TentacleArt } from "./introArt";
import { CameraLayer, IntroGroup, IntroPart, type StageFrame } from "./IntroPart";
import { ArmSvg, EyeSvg, FaceSvg, GLOW_STOPS, HatSvg, HeadSvg, PlaySvg, RingSvg, SoftDiscSvg, SparkleSvg } from "./IntroSvgs";
import { sampleAt, type IntroClock } from "./introWorklets";

export interface IntroStageProps {
  art: TentacleArt;
  geometry: IntroGeometry;
  boxes: PartBoxes;
  samples: IntroSamples;
  hold: IntroHoldSamples;
  gates: { early: readonly number[]; late: readonly number[] };
  frame: StageFrame;
  clock: IntroClock;
}

/** Le cadre de l'écran : un rectangle arrondi au dégradé du logo, que l'écran (au-dessus) découpe. */
function Frame({ art, geometry, frame }: Pick<IntroStageProps, "art" | "geometry" | "frame">) {
  const { outer } = geometry;
  const spec = art.LOGO_GRADIENTS.gV;
  // Le dégradé du logo est en unités du logo : rapporté à la boîte du cadre.
  const at = (x: number, y: number) => ({ x: (x - outer.x) / outer.width, y: (y - outer.y) / outer.height });
  const style = {
    left: frame.center.x + (outer.x - frame.target.x) * frame.zoom,
    top: frame.center.y + (outer.y - frame.target.y) * frame.zoom,
    width: outer.width * frame.zoom,
    height: outer.height * frame.zoom,
    borderRadius: outer.rx * frame.zoom,
  };
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={spec.stops.map((stop) => stop.color)}
        locations={spec.stops.map((stop) => stop.offset)}
        start={at(spec.x1, spec.y1)}
        end={at(spec.x2, spec.y2)}
      />
    </View>
  );
}

/**
 * Ce qui se peint SOUS l'écran : la lueur de la nuit, les bras arrière, la
 * tête, le cadre. L'écran lui-même (la vitre, puis l'accueil) se pose
 * par-dessus, dans l'arbre de l'app (`IntroScreenPlane`).
 */
export const IntroStageBelow = memo(function IntroStageBelow(props: IntroStageProps) {
  const { art, geometry, boxes, samples, gates, frame, clock } = props;
  const { step, parts } = samples;
  return (
    <CameraLayer camera={samples.camera} baseZoom={frame.zoom} clock={clock} step={step}>
      <IntroPart frame={frame} box={boxes.glow} pivot={{ x: 120, y: 136 }} clock={clock} channels={parts.glow} step={step} raster={0.25}>
        {(size) => <SoftDiscSvg size={size.width} stops={GLOW_STOPS} />}
      </IntroPart>
      {art.BACK_ARM_PATHS.map((d, index) => {
        const box = boxes.backArms[index] ?? boxes.head;
        const channels = index ? parts.backArm1 : parts.backArm0;
        const pivot = geometry.backArmPivots[index] ?? geometry.target;
        return [INTRO_PLATES.early, INTRO_PLATES.late].map((raster) => (
          <IntroPart
            key={`${index}-${raster}`}
            frame={frame}
            box={box}
            pivot={pivot}
            clock={clock}
            channels={channels}
            step={step}
            raster={raster}
            gate={raster === INTRO_PLATES.early ? gates.early : gates.late}
          >
            {(size) => <ArmSvg art={art} box={box} d={d} {...size} />}
          </IntroPart>
        ));
      })}
      {[INTRO_PLATES.early, INTRO_PLATES.late].map((raster) => (
        <IntroPart
          key={raster}
          frame={frame}
          box={boxes.head}
          pivot={{ x: 120, y: 132 }}
          clock={clock}
          channels={parts.head}
          step={step}
          raster={raster}
          gate={raster === INTRO_PLATES.early ? gates.early : gates.late}
        >
          {(size) => <HeadSvg art={art} box={boxes.head} {...size} />}
        </IntroPart>
      ))}
      <IntroGroup frame={frame} pivot={{ x: 120, y: 132 }} channels={parts.body} clock={clock} step={step}>
        <Frame art={art} geometry={geometry} frame={frame} />
      </IntroGroup>
    </CameraLayer>
  );
});

/** Les bras avant filent hors champ plus vite que le reste pendant la plongée (parallaxe), puis s'effacent. */
function ArmsAway({ samples, frame, clock, children }: Pick<IntroStageProps, "samples" | "frame" | "clock"> & { children: React.ReactNode }) {
  const { step, armsAway } = samples;
  const style = useAnimatedStyle(() => {
    const t = clock.scene.value;
    return { opacity: sampleAt(armsAway.opacity, step, t), transform: [{ scale: sampleAt(armsAway.scale, step, t) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [frame.center.x, frame.center.y, 0] }, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

/**
 * Ce qui se peint SUR l'écran : le visage, l'onde, le bouton lecture et ses
 * étincelles, le chapeau, puis les bras avant qui enlacent l'écran.
 */
export const IntroStageAbove = memo(function IntroStageAbove(props: IntroStageProps) {
  const { art, geometry, boxes, samples, hold, gates, frame, clock } = props;
  const { step, parts } = samples;
  const faceHatBox = { x: boxes.hat.x, y: boxes.hat.y, width: boxes.hat.width, height: boxes.face.y + boxes.face.height - boxes.hat.y };
  return (
    <CameraLayer camera={samples.camera} baseZoom={frame.zoom} clock={clock} step={step}>
      <IntroGroup frame={frame} pivot={{ x: 120, y: 132 }} channels={parts.body} clock={clock} step={step}>
        {geometry.eyes.map((eye, index) => (
          <IntroPart
            key={eye.x}
            frame={frame}
            box={boxes.eyes[index] ?? boxes.face}
            pivot={eye}
            clock={clock}
            channels={index ? parts.eye1 : parts.eye0}
            loop={hold.eyes[index]}
            step={step}
            gate={gates.early}
          >
            {(size) => <EyeSvg art={art} box={boxes.eyes[index] ?? boxes.face} index={index} {...size} />}
          </IntroPart>
        ))}
        <IntroPart frame={frame} box={boxes.face} pivot={geometry.target} clock={clock} step={step} gate={gates.early}>
          {(size) => <FaceSvg art={art} box={boxes.face} {...size} />}
        </IntroPart>
        <IntroPart frame={frame} box={boxes.ring} pivot={geometry.play} clock={clock} channels={parts.ring} step={step}>
          {(size) => <RingSvg art={art} box={boxes.ring} cx={geometry.play.x} cy={geometry.play.y} {...size} />}
        </IntroPart>
        {/* L'onde de l'attente : la sienne, sans piste (elle ne vaut que pendant l'attente). */}
        <IntroPart frame={frame} box={boxes.ring} pivot={geometry.play} clock={clock} loop={hold.ring} step={step}>
          {(size) => <RingSvg art={art} box={boxes.ring} cx={geometry.play.x} cy={geometry.play.y} {...size} />}
        </IntroPart>
        <IntroPart frame={frame} box={boxes.play} pivot={geometry.play} clock={clock} channels={parts.play} loop={hold.play} step={step}>
          {(size) => <PlaySvg art={art} box={boxes.play} {...size} />}
        </IntroPart>
        {SPARKLES.map((sparkle, index) => {
          const center = sparkleCenter(geometry.play, index);
          const reach = sparkle.radius * 1.9;
          const box = { x: center.x - reach, y: center.y - reach, width: reach * 2, height: reach * 2 };
          return (
            <IntroPart key={index} frame={frame} box={box} pivot={center} clock={clock} loop={hold.sparkles[index]} step={step}>
              {(size) => <SparkleSvg size={size.width} pink={sparkle.pink} />}
            </IntroPart>
          );
        })}
      </IntroGroup>
      <IntroPart frame={frame} box={boxes.hat} pivot={{ x: 120, y: 44 }} clock={clock} channels={parts.hat} step={step} gate={gates.early}>
        {(size) => <HatSvg art={art} box={boxes.hat} {...size} />}
      </IntroPart>
      {/* La plaque nette de la plongée : yeux, visage et chapeau d'un seul dessin, immobiles. */}
      <IntroPart frame={frame} box={faceHatBox} pivot={geometry.target} clock={clock} step={step} raster={INTRO_PLATES.late} gate={gates.late}>
        {(size) => <FaceSvg art={art} box={faceHatBox} eyes hat {...size} />}
      </IntroPart>
      <ArmsAway samples={samples} frame={frame} clock={clock}>
        {art.FRONT_ARM_PATHS.map((d, index) => {
          const box = boxes.frontArms[index] ?? boxes.head;
          const suckers = art.SUCKERS.filter((cup) => (cup.cx < 120 ? 0 : 1) === index);
          return (
            <IntroPart
              key={index}
              frame={frame}
              box={box}
              pivot={geometry.frontArmPivots[index] ?? geometry.target}
              clock={clock}
              channels={index ? parts.frontArm1 : parts.frontArm0}
              step={step}
            >
              {(size) => <ArmSvg art={art} box={box} d={d} suckers={suckers} {...size} />}
            </IntroPart>
          );
        })}
      </ArmsAway>
    </CameraLayer>
  );
});

const styles = StyleSheet.create({
  frame: { position: "absolute", overflow: "hidden" },
});
