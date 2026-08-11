import { describe, it, expect } from "vitest";
import { crediter, TICK_MS, CREDIT_MAX_MS } from "./credit";
import type { Echantillon, EtatSession } from "./types";

/**
 * Toute la justesse de la mesure se joue ici. `crediter` étant pure, chaque
 * scénario est une suite d'échantillons et d'horloges — y compris des cas qu'on
 * ne sait pas provoquer à la main : horloge qui recule, trou de cinq minutes,
 * client fantôme.
 */

const TICKS_PAR_SECONDE = 10_000_000;

function ech(over: Partial<Echantillon> = {}): Echantillon {
  return {
    sessionKey: "s1",
    userId: "u1",
    itemId: "film1",
    itemType: "Movie",
    itemName: "Un film",
    seriesId: null,
    seriesName: null,
    clientName: "Web",
    deviceName: "Chrome",
    runtimeSeconds: 7200,
    paused: false,
    active: true,
    positionTicks: 0,
    checkInMs: null,
    ...over,
  };
}

/** Déroule une suite de relevés et rend les secondes accumulées par session. */
function derouler(
  images: { avanceMs: number; echantillons: Echantillon[] }[],
): { etat: Map<string, EtatSession>; secondes: (k: string) => number } {
  let etat = new Map<string, EtatSession>();
  let mono = 1_000_000;
  let horloge = Date.parse("2026-08-05T20:00:00Z");
  for (const img of images) {
    mono += img.avanceMs;
    horloge += img.avanceMs;
    etat = crediter(etat, img.echantillons, mono, horloge).etat;
  }
  return {
    etat,
    secondes: (k) => Math.round(etat.get(k)?.secondes ?? 0),
  };
}

/** Position qui avance normalement, en ticks. */
const pos = (secondes: number) => secondes * TICKS_PAR_SECONDE;

describe("crediter", () => {
  it("ne crédite rien au tout premier relevé", () => {
    const { secondes } = derouler([{ avanceMs: 0, echantillons: [ech()] }]);
    expect(secondes("s1::film1")).toBe(0);
  });

  it("crédite le temps écoulé sur une lecture normale", () => {
    const images = Array.from({ length: 11 }, (_, i) => ({
      avanceMs: i === 0 ? 0 : TICK_MS,
      echantillons: [ech({ positionTicks: pos(i * 15) })],
    }));
    // 11 relevés → 10 intervalles de 15 s.
    expect(derouler(images).secondes("s1::film1")).toBe(150);
  });

  it("ne compte pas le temps en pause", () => {
    const { secondes } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15), paused: true })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15), paused: true })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(30) })] },
    ]);
    // Seuls le 1er et le dernier intervalle sont en lecture des deux côtés.
    expect(secondes("s1::film1")).toBe(30);
  });

  it("écrête un trou de cinq minutes au maximum autorisé", () => {
    const { secondes } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] },
      { avanceMs: 300_000, echantillons: [ech({ positionTicks: pos(300) })] },
    ]);
    expect(secondes("s1::film1")).toBe(CREDIT_MAX_MS / 1000);
  });

  it("cesse de créditer une lecture dont la position est figée", () => {
    // Le client est mort mais Jellyfin croit encore qu'il joue : ni pause, ni
    // inactivité — seule la position immobile trahit le fantôme.
    const images = [{ avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] }];
    for (let i = 0; i < 20; i++) images.push({ avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(0) })] });
    // 120 s de tolérance, soit 8 intervalles de 15 s, puis plus rien.
    expect(derouler(images).secondes("s1::film1")).toBe(120);
  });

  it("ne crédite pas quand le signe de vie du client est périmé", () => {
    const horlogeDepart = Date.parse("2026-08-05T20:00:00Z");
    let etat = new Map<string, EtatSession>();
    etat = crediter(etat, [ech({ positionTicks: pos(0) })], 1000, horlogeDepart).etat;
    const bilan = crediter(
      etat,
      [ech({ positionTicks: pos(15), checkInMs: horlogeDepart - 200_000 })],
      1000 + TICK_MS,
      horlogeDepart + TICK_MS,
    );
    expect(Math.round(bilan.etat.get("s1::film1")!.secondes)).toBe(0);
  });

  it("crédite quand le signe de vie est inconnu — inconnu n'est pas périmé", () => {
    const { secondes } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0), checkInMs: null })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15), checkInMs: null })] },
    ]);
    expect(secondes("s1::film1")).toBe(15);
  });

  it("repart de zéro quand la session change de titre", () => {
    const { secondes, etat } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ itemId: "film2", positionTicks: pos(0) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ itemId: "film2", positionTicks: pos(15) })] },
    ]);
    expect(secondes("s1::film2")).toBe(15);
    expect(etat.has("s1::film1")).toBe(false);
  });

  it("crédite l'intervalle de clôture quand la session disparaît", () => {
    let etat = new Map<string, EtatSession>();
    let mono = 1000;
    const h = Date.parse("2026-08-05T20:00:00Z");
    etat = crediter(etat, [ech({ positionTicks: pos(0) })], mono, h).etat;
    mono += TICK_MS;
    etat = crediter(etat, [ech({ positionTicks: pos(15) })], mono, h + TICK_MS).etat;
    mono += 10_000;
    const bilan = crediter(etat, [], mono, h + TICK_MS + 10_000);
    expect(bilan.aFermer).toHaveLength(1);
    // 15 s mesurées, plus les 10 s écoulées jusqu'à l'arrêt.
    expect(Math.round(bilan.aFermer[0].secondes)).toBe(25);
  });

  it("ne crédite pas la clôture d'une session déjà en pause", () => {
    let etat = new Map<string, EtatSession>();
    const h = Date.parse("2026-08-05T20:00:00Z");
    etat = crediter(etat, [ech({ positionTicks: pos(0), paused: true })], 1000, h).etat;
    const bilan = crediter(etat, [], 1000 + TICK_MS, h + TICK_MS);
    expect(Math.round(bilan.aFermer[0].secondes)).toBe(0);
  });

  it("plafonne un compte qui joue sur deux appareils à la fois", () => {
    // Deux sessions du même utilisateur, chacune en lecture : le temps réel
    // écoulé reste 15 s, pas 30.
    const deux = (p: number) => [
      ech({ sessionKey: "s1", positionTicks: pos(p) }),
      ech({ sessionKey: "s2", itemId: "film2", positionTicks: pos(p) }),
    ];
    const { etat } = derouler([
      { avanceMs: 0, echantillons: deux(0) },
      { avanceMs: TICK_MS, echantillons: deux(15) },
    ]);
    const total = (etat.get("s1::film1")?.secondes ?? 0) + (etat.get("s2::film2")?.secondes ?? 0);
    expect(Math.round(total)).toBe(15);
  });

  it("ne plafonne pas deux comptes distincts qui regardent en même temps", () => {
    const deux = (p: number) => [
      ech({ sessionKey: "s1", userId: "u1", positionTicks: pos(p) }),
      ech({ sessionKey: "s2", userId: "u2", itemId: "film2", positionTicks: pos(p) }),
    ];
    const { etat } = derouler([
      { avanceMs: 0, echantillons: deux(0) },
      { avanceMs: TICK_MS, echantillons: deux(15) },
    ]);
    expect(Math.round(etat.get("s1::film1")!.secondes)).toBe(15);
    expect(Math.round(etat.get("s2::film2")!.secondes)).toBe(15);
  });

  it("ne crédite rien si l'horloge monotone recule", () => {
    let etat = new Map<string, EtatSession>();
    const h = Date.parse("2026-08-05T20:00:00Z");
    etat = crediter(etat, [ech({ positionTicks: pos(0) })], 500_000, h).etat;
    etat = crediter(etat, [ech({ positionTicks: pos(15) })], 400_000, h + TICK_MS).etat;
    expect(Math.round(etat.get("s1::film1")!.secondes)).toBe(0);
  });

  it("continue de créditer malgré une avance rapide ou un retour arrière", () => {
    const { secondes } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(600) })] }, // saut avant
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(120) })] }, // saut arrière
    ]);
    // Le temps réellement passé devant l'écran reste 30 s : la position sert de
    // preuve de vie, jamais de mesure.
    expect(secondes("s1::film1")).toBe(30);
  });

  it("ignore une session marquée inactive", () => {
    const { secondes } = derouler([
      { avanceMs: 0, echantillons: [ech({ positionTicks: pos(0) })] },
      { avanceMs: TICK_MS, echantillons: [ech({ positionTicks: pos(15), active: false })] },
    ]);
    expect(secondes("s1::film1")).toBe(0);
  });
});
