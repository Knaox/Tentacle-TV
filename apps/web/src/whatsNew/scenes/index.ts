// Le kit de scènes de l'écran de nouveautés — voir docs/NOUVEAUTES.md. Les
// « faux » composants n'ont de faux que l'interaction : ils rendent les vrais
// composants de l'app (carte, étoiles, interrupteur) avec de vraies données
// (cf. sceneMedia.ts).
export { SceneStage } from "./SceneStage";
export { Place, type Animated, type Placed } from "./Place";
export { FauxCard, CARD_TONES } from "./FauxCard";
export { FauxRow } from "./FauxRow";
export { FauxChip } from "./FauxChip";
export { FauxToggle } from "./FauxToggle";
export { FauxStars } from "./FauxStars";
export { FauxCursor } from "./FauxCursor";
export { FauxConfetti } from "./FauxConfetti";
export { ScenePlayerPanel } from "./ScenePlayerPanel";
export { useSceneClock, type SceneClock } from "./useSceneClock";
export { STAGE_H, STAGE_W, cursorTravel, instant, sceneSpring, sceneTween } from "./sceneMotion";
