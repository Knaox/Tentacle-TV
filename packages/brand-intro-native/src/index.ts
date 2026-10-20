/**
 * La vue de l'ouverture du démarrage, partagée par la TV et le mobile (carnet :
 * `docs/OUVERTURE.md`). Le pur est dans `@tentacle-tv/shared/brandIntro`.
 */
export { BOOT_INK, BootIntroView, useIntroScene, type BootIntroViewProps, type IntroScene, type IntroSceneOptions } from "./BootIntroView";
export { CLOCK, useIntroClock, type IntroClockControl, type IntroClockEvents, type IntroWallTrace } from "./useIntroClock";
export type { IntroClock } from "./introWorklets";
export type { TentacleArt, LinearGradientSpec, GradientStop } from "./introArt";
export {
  ViewRoundClip,
  type IntroGradientProps,
  type IntroPrimitives,
  type IntroRoundClipProps,
} from "./introPrimitives";
export {
  bootIntroGate,
  useBootIntroLanded,
  useBootIntroPlaying,
  useBootIntroReport,
  useReportBlockedToBootIntro,
  useReportScreenToBootIntro,
  type BootIntroReport,
} from "./bootIntroGate";
export { bootSound } from "./bootSound";
export { useBootIntroRun, type BootIntroRun, type BootIntroRunOptions } from "./useBootIntroRun";
