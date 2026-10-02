import { byName } from "../data/playerModels";
import { aimedWith, base, patch, scene, type Build, type Patch } from "./playerScenes";
import type { BenchScene } from "./types";

/**
 * La tête de lecture sur un film de 2 h (« Les Gardiens de la Galaxie »,
 * 2 h 01), la portion chargée à sa droite aux avances RÉELLES des trois
 * chemins : lecture directe (≈ 1 min 30), transcodage (≈ 30 s), PrismCore
 * (AVPlayer plafonné à 10 s sur le bouclage). Puis, sur le transcodage : en
 * pause, en avance rapide, en recul (le chargé reste à droite de la position)
 * et pendant le décompte. Planche avant/après : `lecteur/tete-*`.
 */

const guardians: Build = (data) => base(data, byName(data, "Les Gardiens de la Galaxie"), 0.42);

/** La fin du tampon, `ahead` secondes devant la position. */
const loaded = (ahead: number): Patch => (_data, stage) => {
  const { timeline } = stage.props;
  return { timeline: { ...timeline, buffered: Math.min(timeline.duration, timeline.position + ahead) } };
};

const transcoded = patch(guardians, loaded(30));

/** Un défilement de `offset` secondes, à la vitesse d'un maintien. */
const scrubbing = (offset: number, factor: number): Patch => (_data, stage) => ({
  scrub: {
    target: stage.props.timeline.position + offset,
    speed: { factor, backward: offset < 0 },
    frame: stage.frame ? { uri: stage.frame } : null,
  },
});

export const PLAYHEAD_SCENES: BenchScene[] = [
  scene("tete-directe", "Tête de lecture · lecture directe, 1 min 30 chargée", patch(guardians, loaded(90))),
  scene("tete-transcodage", "Tête de lecture · transcodage, 30 s chargées", transcoded),
  scene("tete-prismcore", "Tête de lecture · PrismCore, 10 s chargées", patch(guardians, loaded(10))),
  scene("tete-pause", "Tête de lecture · en pause", patch(transcoded, () => ({ paused: true }))),
  scene("tete-avance", "Tête de lecture · avance rapide ×4", patch(transcoded, scrubbing(750, 4))),
  scene("tete-recul", "Tête de lecture · recul ×2, le chargé à droite", patch(transcoded, scrubbing(-240, 2))),
  scene("tete-decompte", "Tête de lecture · décompte, lecture dans 3 s", patch(transcoded, aimedWith("play", 3, 212))),
];
