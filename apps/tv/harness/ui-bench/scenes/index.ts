import { BENCH_SCENES } from "./benchScenes";
import { BRICK_SCENES } from "./brickScenes";
import { BROWSE_SCENES } from "./browseScenes";
import { COLLECTION_SCENES } from "./collectionScenes";
import { DETAIL_SCENES } from "./detailScenes";
import { FOR_YOU_SCENES } from "./forYouScenes";
import { GLASS_SCENES } from "./glassScenes";
import { HOME_SCENES } from "./homeScenes";
import { LEGIBILITY_SCENES } from "./legibilityScenes";
import { LIBRARY_SCENES } from "./libraryScenes";
import { MEASURE_SCENES } from "./measureScenes";
import { MOTION_SCENES } from "./motionScenes";
import { NAV_SCENES } from "./navScenes";
import { OVERLAY_SCENES } from "./overlayScenes";
import { PAIRING_SCENES } from "./pairingScenes";
import { PLAYER_SCENES } from "./playerScenes";
import { SEARCH_SCENES } from "./searchScenes";
import { SETTINGS_SCENES } from "./settingsScenes";
import { SHEET_SCENES } from "./sheetScenes";
import { TRAILER_SCENES } from "./trailerScenes";
import type { BenchScene } from "./types";

/**
 * Le catalogue, dans l'ordre du menu — l'ordre du parcours dans l'app.
 * Chaque écran a son fichier de scènes (un état par scène) : le menu,
 * `bench.mjs next` et les planches les voient aussitôt.
 */
export const SCENES: BenchScene[] = [
  ...PAIRING_SCENES,
  ...HOME_SCENES,
  ...NAV_SCENES,
  ...DETAIL_SCENES,
  ...LIBRARY_SCENES,
  ...COLLECTION_SCENES,
  ...SEARCH_SCENES,
  ...BROWSE_SCENES,
  ...FOR_YOU_SCENES,
  ...SETTINGS_SCENES,
  ...PLAYER_SCENES,
  ...SHEET_SCENES,
  ...TRAILER_SCENES,
  ...OVERLAY_SCENES,
  ...BRICK_SCENES,
  ...GLASS_SCENES,
  ...LEGIBILITY_SCENES,
  ...MEASURE_SCENES,
  ...MOTION_SCENES,
  ...BENCH_SCENES,
];

export const SCENE_BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));
