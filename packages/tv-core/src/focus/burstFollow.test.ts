import { describe, expect, it } from "vitest";
import { BURST_FOLLOW, burstSegmentMs, clampRowOffset, linearAt, rowRevealOffset, settleVelocity } from "./burstFollow";
import { springAt } from "./revealMotion";

describe("burstSegmentMs — la durée d'un segment de rafale", () => {
  it("reprend l'intervalle réel au pas précédent", () => {
    expect(burstSegmentMs(150)).toBe(150);
    expect(burstSegmentMs(50)).toBe(50);
  });

  it("bornée : la première répétition (~470 ms) reprend la cadence ; une répétition en avance ne fait pas un saut", () => {
    expect(burstSegmentMs(470)).toBe(BURST_FOLLOW.maxSegmentMs);
    expect(burstSegmentMs(5)).toBe(BURST_FOLLOW.minSegmentMs);
  });
});

describe("linearAt — un segment à vitesse constante", () => {
  it("avance proportionnellement et dit sa vitesse en unités par seconde", () => {
    expect(linearAt(0, 100, 500, 200)).toEqual({ x: 100, v: 2000, done: false });
    expect(linearAt(100, 100, 500, 200)).toEqual({ x: 300, v: 2000, done: false });
  });

  it("au bout, posé sur la cible, à l'arrêt", () => {
    expect(linearAt(200, 100, 500, 200)).toEqual({ x: 500, v: 0, done: true });
    expect(linearAt(10, 100, 500, 0)).toEqual({ x: 500, v: 0, done: true });
  });

  it("des pas réguliers enchaînés : la vitesse est la même d'un segment à l'autre", () => {
    // Trois pas de 400 toutes les 150 ms : chaque segment part de la cible du précédent.
    const speeds = [0, 400, 800].map((from) => linearAt(75, from, from + 400, 150).v);
    expect(new Set(speeds).size).toBe(1);
  });
});

describe("settleVelocity — reprendre un segment en vol sur le ressort", () => {
  const response = 0.5;
  const omega = (2 * Math.PI) / response;

  it("garde la vitesse du segment quand elle ne fait pas dépasser la cible", () => {
    expect(settleVelocity(-400, 1000, response)).toBe(1000);
  });

  it("la borne à ω·|x0| : le ressort critique arrive sans dépasser", () => {
    const v = settleVelocity(-50, 4000, response);
    expect(v).toBeCloseTo(omega * 50, 6);
    for (let t = 0; t <= 2; t += 0.01) expect(springAt(t, -50, v, response, 1).x).toBeLessThanOrEqual(1e-9);
  });

  it("une vitesse qui s'éloigne de la cible, ou déjà sur la cible : rien", () => {
    expect(settleVelocity(-400, -1000, response)).toBe(0);
    expect(settleVelocity(0, 1000, response)).toBe(0);
  });

  it("dans l'autre sens aussi", () => {
    expect(settleVelocity(300, -800, response)).toBe(-800);
    expect(settleVelocity(10, -8000, response)).toBeCloseTo(-omega * 10, 6);
  });
});

describe("rowRevealOffset — la rangée qui montre la carte focalisée", () => {
  // Une rangée de 10 cartes de 300, écart 40, retrait 176, marge 96, vue de 1920.
  const card = (i: number) => ({ left: 176 + i * 340, width: 300 });
  const content = 176 + 10 * 340 - 40 + 96;
  const track = { viewport: 1920, content, leading: 176, trailing: 96 };

  it("une carte déjà entière dans les marges : rien ne bouge", () => {
    expect(rowRevealOffset(card(2), track, 0)).toBe(0);
  });

  it("vers la droite : le moins possible, la carte à la marge droite", () => {
    // Carte 5 : son bord droit 176 + 1700 + 300 = 2176, + 96 − 1920 = 352.
    expect(rowRevealOffset(card(5), track, 0)).toBe(352);
  });

  it("vers la gauche : la carte au retrait gauche ; la première ramène au début", () => {
    expect(rowRevealOffset(card(3), track, 1100)).toBe(card(3).left - 176);
    expect(rowRevealOffset(card(0), track, 500)).toBe(0);
  });

  it("la dernière carte amène la rangée à sa fin, jamais au-delà", () => {
    expect(rowRevealOffset(card(9), track, 0)).toBe(content - 1920);
    expect(clampRowOffset(99_999, track)).toBe(content - 1920);
    expect(clampRowOffset(-5, track)).toBe(0);
  });

  it("depuis là où elle va déjà (la cible d'un mouvement en cours)", () => {
    const going = rowRevealOffset(card(5), track, 0);
    expect(rowRevealOffset(card(4), track, going)).toBe(going);
  });

  it("une rangée plus courte que l'écran ne défile pas", () => {
    expect(rowRevealOffset({ left: 176, width: 300 }, { viewport: 1920, content: 800, leading: 176, trailing: 96 }, 0)).toBe(0);
  });
});
