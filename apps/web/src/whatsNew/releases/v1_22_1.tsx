import type { WhatsNewRelease } from "../types";

/**
 * 1.22.1 — entrée VIDE, en connaissance de cause.
 *
 * La version apporte au site web, sur téléphone et sur iPad, la présentation
 * de l'application mobile. L'application de bureau, elle, ne change pas : il
 * n'y a rien à lui montrer.
 *
 * L'entrée existe quand même : elle dit « rien à montrer », là où son absence
 * laisserait supposer un oubli (cf. registry.test.ts).
 */
export const RELEASE_1_22_1: WhatsNewRelease = {
  version: "1.22.1",
  features: [],
};
