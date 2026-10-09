import type { WhatsNewRelease } from "../types";
import { RELEASE_1_21_0 } from "./v1_21_0";
import { RELEASE_1_21_1 } from "./v1_21_1";
import { RELEASE_1_21_2 } from "./v1_21_2";
import { RELEASE_1_21_3 } from "./v1_21_3";
import { RELEASE_1_21_4 } from "./v1_21_4";
import { RELEASE_1_22_0 } from "./v1_22_0";
import { RELEASE_1_23_0 } from "./v1_23_0";
import { RELEASE_1_24_0 } from "./v1_24_0";
import { RELEASE_1_25_0 } from "./v1_25_0";
import { RELEASE_1_25_1 } from "./v1_25_1";
import { RELEASE_1_25_2 } from "./v1_25_2";
import { RELEASE_1_25_3 } from "./v1_25_3";
import { RELEASE_1_25_4 } from "./v1_25_4";
import { RELEASE_1_25_5 } from "./v1_25_5";
import { RELEASE_1_26_0 } from "./v1_26_0";
import { RELEASE_1_27_0 } from "./v1_27_0";
import { RELEASE_1_28_0 } from "./v1_28_0";

/**
 * Le registre, du plus récent au plus ancien. L'ordre est vérifié par
 * registry.test.ts, comme la présence de la version courante
 * (versions.json → desktop) : une version sans rien à montrer garde son
 * entrée, vide — elle dit « rien », elle ne laisse pas supposer « oublié ».
 */
export const WHATS_NEW_RELEASES: readonly WhatsNewRelease[] = [
  RELEASE_1_28_0,
  RELEASE_1_27_0,
  RELEASE_1_26_0,
  RELEASE_1_25_5,
  RELEASE_1_25_4,
  RELEASE_1_25_3,
  RELEASE_1_25_2,
  RELEASE_1_25_1,
  RELEASE_1_25_0,
  RELEASE_1_24_0,
  RELEASE_1_23_0,
  RELEASE_1_22_0,
  RELEASE_1_21_4,
  RELEASE_1_21_3,
  RELEASE_1_21_2,
  RELEASE_1_21_1,
  RELEASE_1_21_0,
];

export function findRelease(version: string): WhatsNewRelease | undefined {
  return WHATS_NEW_RELEASES.find((release) => release.version === version);
}
