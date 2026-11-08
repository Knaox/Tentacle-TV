import { describe, expect, it } from "vitest";
import { filledPoints, playedFraction, seekBarTick } from "./positionTicks";

const at = (positionMs: number, durationMs: number | null = 180_000) => ({ positionMs, durationMs, running: true });

/** Les graines distinctes d'une écoute entière, une position tous les 250 ms (la cadence du moteur). */
function distinctTicks(durationMs: number, tick: (p: ReturnType<typeof at>) => string | number): number {
  const seen = new Set<string | number>();
  for (let ms = 0; ms <= durationMs; ms += 250) seen.add(tick(at(ms, durationMs)));
  return seen.size;
}

describe("fraction jouée", () => {
  it("vaut 0 sans durée connue et reste dans [0, 1]", () => {
    expect(playedFraction(5_000, null)).toBe(0);
    expect(playedFraction(5_000, 0)).toBe(0);
    expect(playedFraction(-10, 1_000)).toBe(0);
    expect(playedFraction(2_000, 1_000)).toBe(1);
    expect(playedFraction(250, 1_000)).toBe(0.25);
  });
});

describe("filet du mini-lecteur : un point à la fois", () => {
  it("donne des points entiers, 0 sans largeur ni durée", () => {
    expect(filledPoints(at(90_000), 343)).toBe(172);
    expect(filledPoints(at(90_000, null), 343)).toBe(0);
    expect(filledPoints(at(90_000), 0)).toBe(0);
    expect(filledPoints(at(500_000), 343)).toBe(343);
  });

  it("ne change pas entre deux positions du même point", () => {
    expect(filledPoints(at(1_000), 343)).toBe(filledPoints(at(1_250), 343));
  });

  it("redessine environ deux fois moins qu'il ne reçoit de positions sur un titre de 3 min", () => {
    const notifications = 180_000 / 250 + 1;
    const redraws = distinctTicks(180_000, (p) => filledPoints(p, 343));
    expect(redraws).toBe(344);
    expect(redraws).toBeLessThan(notifications / 2);
  });
});

describe("barre de position du lecteur plein écran", () => {
  it("garde la même graine tant que rien d'affiché ne change", () => {
    expect(seekBarTick(at(10_100, 180_000), 0)).toBe(seekBarTick(at(10_300, 180_000), 0));
  });

  it("change avec la seconde écoulée", () => {
    expect(seekBarTick(at(10_900, 180_000), 0)).not.toBe(seekBarTick(at(11_000, 180_000), 0));
  });

  it("change avec la seconde RESTANTE, même quand l'écoulée ne bouge pas", () => {
    // Durée de 180,5 s : le reste passe de 170 à 169 s à 10,5 s d'écoute.
    expect(seekBarTick(at(10_400, 180_500), 0)).not.toBe(seekBarTick(at(10_600, 180_500), 0));
  });

  it("change avec le point de la piste", () => {
    expect(seekBarTick(at(10_100, 20_000), 343)).not.toBe(seekBarTick(at(10_200, 20_000), 343));
  });

  it("dit l'absence de durée", () => {
    expect(seekBarTick(at(3_000, null), 343)).toBe("3||0");
  });
});
