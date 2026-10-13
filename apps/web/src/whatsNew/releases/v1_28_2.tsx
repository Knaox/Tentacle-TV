import type { WhatsNewRelease } from "../types";
import { ForYouScene } from "../scenes/v1_28_2";

/**
 * 1.28.2 — « Pour vous », refaite.
 *
 * Une scène : la une de ce soir (raison, correspondance, Lire, bande-annonce),
 * « Ou bien » qui en met une autre à la une d'un clic, et « Films pour vous »
 * dessous. Le reste du bloc (la page qui ne bouge plus sous les yeux, le titre
 * jugé qui part au lâcher, « Vu » sur une série entière) se dit dans le texte.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_28_2_<id>_title / _body).
 */
export const RELEASE_1_28_2: WhatsNewRelease = {
  version: "1.28.2",
  features: [
    {
      id: "forYou",
      kind: "improved",
      titleKey: "v1_28_2_forYou_title",
      bodyKey: "v1_28_2_forYou_body",
      Scene: ForYouScene,
      route: "/recommendations",
    },
  ],
};
