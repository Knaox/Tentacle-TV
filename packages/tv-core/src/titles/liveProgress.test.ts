import { describe, expect, it } from "vitest";
import type { MyTitleState } from "@tentacle-tv/shared";
import {
  LIVE_PROGRESS,
  anyAdvancing,
  arrivedBetween,
  colorFraction,
  isProjectable,
  livelyFirst,
  projectedPercent,
  steadyPercent,
} from "./liveProgress";
import { MY_TITLES_REFRESH } from "./titlesGate";

const AT = 1_000_000;
const sec = (s: number) => AT + s * 1000;

describe("l'avancement entre deux lectures", () => {
  it("suit le temps restant, en ligne droite jusqu'à l'échéance", () => {
    const reading = { percent: 40, etaSeconds: 600, at: AT };
    expect(projectedPercent(reading, AT)).toBe(40);
    // Un dixième du temps restant : un dixième de ce qui reste à venir.
    expect(projectedPercent(reading, sec(60))).toBeCloseTo(46, 5);
    expect(projectedPercent(reading, sec(300))).toBeCloseTo(70, 5);
  });

  it("ne dit jamais 100 % de lui-même : seule une vraie lecture le dit", () => {
    const reading = { percent: 40, etaSeconds: 600, at: AT };
    expect(projectedPercent(reading, sec(600))).toBe(LIVE_PROGRESS.ceiling);
    expect(projectedPercent(reading, sec(5000))).toBe(LIVE_PROGRESS.ceiling);
    expect(projectedPercent({ percent: 100, etaSeconds: 30, at: AT }, sec(10))).toBe(100);
  });

  it("reste immobile sans temps restant, ou sans avancement su", () => {
    expect(projectedPercent({ percent: 40, etaSeconds: null, at: AT }, sec(60))).toBe(40);
    expect(projectedPercent({ percent: 40, etaSeconds: 0, at: AT }, sec(60))).toBe(40);
    expect(projectedPercent({ percent: null, etaSeconds: 600, at: AT }, sec(60))).toBeNull();
    expect(isProjectable({ percent: 40, etaSeconds: null, at: AT })).toBe(false);
    expect(isProjectable({ percent: null, etaSeconds: 600, at: AT })).toBe(false);
    expect(isProjectable({ percent: 40, etaSeconds: 600, at: AT })).toBe(true);
  });

  it("une horloge en arrière (réception dans le futur) ne fait pas reculer", () => {
    expect(projectedPercent({ percent: 40, etaSeconds: 600, at: AT }, sec(-30))).toBe(40);
  });
});

describe("ce que l'écran garde", () => {
  it("ne recule pas quand une lecture arrive un peu en deçà de la projection", () => {
    // La projection montrait 47 ; la lecture dit 45 (le serveur garde sa liste 10 s).
    expect(steadyPercent(47, 45, 45)).toBe(47);
    expect(steadyPercent(47, 48, 45)).toBe(48);
  });

  it("montre une vraie chute (une reprise de zéro)", () => {
    expect(steadyPercent(47, 3, 3)).toBe(3);
  });

  it("prend la valeur suivante quand rien n'était montré, ou plus rien ne se sait", () => {
    expect(steadyPercent(null, 12, 12)).toBe(12);
    expect(steadyPercent(47, null, null)).toBeNull();
  });
});

describe("la couleur d'une affiche attendue", () => {
  it("est grise en attente et bloquée, quel que soit l'avancement", () => {
    expect(colorFraction("pending", null)).toBe(0);
    expect(colorFraction("blocked", 80)).toBe(0);
  });

  it("se colore au prorata en route : 0, 25, 50, 75, 100 %", () => {
    expect([0, 25, 50, 75, 100].map((p) => colorFraction("arriving", p))).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(colorFraction("arriving", null)).toBe(0);
    expect(colorFraction("arriving", 140)).toBe(1);
  });

  it("est pleine dès que le fichier est là, et à l'arrivée", () => {
    expect(colorFraction("importing", null)).toBe(1);
    expect(colorFraction("arrived", null)).toBe(1);
  });
});

const title = (key: string, state: MyTitleState) => ({ key, state });

describe("ce qui avance, et ce qui est arrivé", () => {
  it("avance : en route ou en train d'entrer ; ni l'attente ni le blocage", () => {
    expect(anyAdvancing([title("a", "pending"), title("b", "blocked")])).toBe(false);
    expect(anyAdvancing([title("a", "pending"), title("b", "importing")])).toBe(true);
    expect(anyAdvancing([title("a", "arriving")])).toBe(true);
    expect(anyAdvancing(null)).toBe(false);
  });

  it("met ce qui bouge en tête, le reste dans l'ordre reçu", () => {
    const list = [title("p1", "pending"), title("i", "importing"), title("b", "blocked"), title("a", "arriving"), title("p2", "pending")];
    expect(livelyFirst(list).map((t) => t.key)).toEqual(["a", "i", "p1", "b", "p2"]);
  });

  it("n'est arrivé que ce qui sort de la liste en avançant", () => {
    const before = [title("a", "arriving"), title("i", "importing"), title("p", "pending"), title("b", "blocked"), title("s", "arriving")];
    const after = [title("s", "arriving")];
    expect(arrivedBetween(before, after).map((t) => t.key)).toEqual(["a", "i"]);
    expect(arrivedBetween(null, after)).toEqual([]);
    expect(arrivedBetween(before, null)).toEqual([]);
  });
});

describe("le rythme du direct", () => {
  it("est celui de Vigie : 10 s, plus vif que la liste ouverte", () => {
    expect(MY_TITLES_REFRESH.liveMs).toBe(10_000);
    expect(MY_TITLES_REFRESH.liveMs).toBeLessThan(MY_TITLES_REFRESH.watchingMs);
  });
});
