import type { WhatsNewRelease } from "../types";

/**
 * 1.21.2 — l'entrée est posée VIDE, le temps que les nouveautés de cette
 * version existent vraiment dans le code.
 *
 * Le registre exige une entrée pour `versions.json → desktop` (registry.test.ts,
 * et donc la CI « Qualité » sur tout push) : la poser au moment du bump garde
 * `main` verte, là où l'ordre inverse — bumper puis remplir plus tard — l'avait
 * laissée rouge entre deux commits en 1.21.1. Une entrée vide ne montre rien à
 * personne : `selectFeatures` ne parcourt pas une liste vide.
 *
 * Les scènes et leurs textes arrivent quand les chantiers qu'elles racontent
 * sont finis. Les textes vivront dans l'espace i18n `whatsNew`
 * (v1_21_2_<id>_title / _body).
 */
export const RELEASE_1_21_2: WhatsNewRelease = {
  version: "1.21.2",
  features: [],
};
