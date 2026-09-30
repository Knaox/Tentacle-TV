/**
 * Les règles du mouvement d'Apple TV, tenues par les valeurs elles-mêmes :
 * une retouche de `TV_MOTION` qui les casserait échoue ici, pas sur le
 * simulateur trois jours plus tard.
 */

import { describe, expect, it } from "vitest";

import { TV_MOTION, type TvSpring } from "./tvMotion";

/** Le dépassement d'un ressort sous-amorti, en fraction de la course. */
const overshoot = ({ dampingFraction: zeta }: TvSpring) =>
  zeta >= 1 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));

describe("TV_MOTION", () => {
  it("ce qui s'en va est plus bref que ce qui arrive", () => {
    expect(TV_MOTION.reveal.outMs).toBeLessThan(TV_MOTION.reveal.inMs);
    expect(TV_MOTION.overlay.veilOutMs).toBeLessThan(TV_MOTION.overlay.veilInMs);
    expect(TV_MOTION.crossfade.heroTextOutMs).toBeLessThan(TV_MOTION.crossfade.heroTextInMs);
  });

  it("aucune transition d'interface ne dépasse une demi-seconde, sauf celles des images", () => {
    const { crossfade, image, ...ui } = TV_MOTION;
    const durations = JSON.stringify(ui).match(/"\w+Ms":(\d+)/g) ?? [];
    for (const entry of durations) expect(Number(entry.split(":")[1])).toBeLessThanOrEqual(500);
    // Une image qui change ou se pose prend son temps — jamais une seconde.
    for (const ms of [crossfade.heroMs, crossfade.ambientMs, image.settleMs, image.fadeInMs]) expect(ms).toBeLessThan(1000);
  });

  it("les ressorts du focus et des panneaux ne rebondissent pas à l'œil", () => {
    // Moins de 2 % de la course : sur une affiche agrandie de 8 %, un
    // cinquième de point.
    expect(overshoot(TV_MOTION.spring.focus)).toBeLessThan(0.02);
    expect(overshoot(TV_MOTION.spring.panel)).toBeLessThan(0.01);
    expect(overshoot(TV_MOTION.spring.unfold)).toBeLessThan(0.01);
    // L'appui relâché, lui, rebondit un peu — c'est son rôle — sans trembler.
    expect(overshoot(TV_MOTION.spring.press)).toBeLessThan(0.1);
  });

  it("les courbes restent des cubiques valides (abscisses dans [0, 1])", () => {
    for (const [x1, , x2] of Object.values(TV_MOTION.curve)) {
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
    }
  });
});
