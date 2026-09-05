import type { WhatsNewRelease } from "../types";
import { RELEASE_1_21_0 } from "./v1_21_0";

/**
 * Le registre, du plus récent au plus ancien. L'ordre est vérifié par
 * registry.test.ts, comme la présence de la version courante
 * (versions.json → desktop) : une version sans rien à montrer garde son
 * entrée, vide — elle dit « rien », elle ne laisse pas supposer « oublié ».
 */
export const WHATS_NEW_RELEASES: readonly WhatsNewRelease[] = [RELEASE_1_21_0];

export function findRelease(version: string): WhatsNewRelease | undefined {
  return WHATS_NEW_RELEASES.find((release) => release.version === version);
}
