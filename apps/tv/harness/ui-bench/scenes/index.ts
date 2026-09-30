import { BENCH_SCENES } from "./benchScenes";
import type { BenchScene } from "./types";

/**
 * Le catalogue, dans l'ordre du menu. Chaque écran de la refonte ajoute ici
 * son fichier de scènes (un état par scène) : le menu, `bench.mjs next` et
 * les planches les voient aussitôt.
 */
export const SCENES: BenchScene[] = [...BENCH_SCENES];

export const SCENE_BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));
