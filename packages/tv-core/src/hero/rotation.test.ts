import { describe, expect, it } from "vitest";
import type { RemoteIntent } from "../remote/intents";
import {
  HERO_MAX_ITEMS,
  HERO_ROTATE_MS,
  heroEdgeKey,
  heroHoldAfter,
  heroInView,
  heroItemsOf,
  heroRotateDelay,
  heroRotationActive,
  heroRotationArmed,
  heroRotationRearms,
  heroShown,
  nextHeroIndex,
} from "./rotation";

describe("heroItemsOf — les titres du héros", () => {
  it("les reprises d'abord, cinq au plus", () => {
    expect(HERO_MAX_ITEMS).toBe(5);
    expect(heroItemsOf([1, 2, 3, 4, 5, 6, 7], [9])).toEqual({ items: [1, 2, 3, 4, 5], fromResume: true });
  });

  it("sans reprise, la sélection du serveur", () => {
    expect(heroItemsOf([], [8, 9])).toEqual({ items: [8, 9], fromResume: false });
    expect(heroItemsOf(undefined, undefined)).toEqual({ items: [], fromResume: false });
  });
});

describe("la rotation — quand le titre change", () => {
  it("8 s, 16 s en mouvement réduit", () => {
    expect(HERO_ROTATE_MS).toBe(8_000);
    expect(heroRotateDelay(false)).toBe(8_000);
    expect(heroRotateDelay(true)).toBe(16_000);
  });

  it("en marche seulement affiché, application active, deux titres au moins", () => {
    expect(heroRotationActive({ shown: true, appActive: true, count: 2 })).toBe(true);
    expect(heroRotationActive({ shown: false, appActive: true, count: 5 })).toBe(false);
    expect(heroRotationActive({ shown: true, appActive: false, count: 5 })).toBe(false);
    expect(heroRotationActive({ shown: true, appActive: true, count: 1 })).toBe(false);
  });

  it("le héros quitte le champ à plus de moitié défilé (accueil : 56 + 640 / 2 = 376)", () => {
    expect(heroInView(375, 56, 640)).toBe(true);
    expect(heroInView(376, 56, 640)).toBe(false);
  });

  it("tout geste relance l'attente, sauf Retour", () => {
    const gestures: RemoteIntent[] = [
      { type: "move", direction: "droite" },
      { type: "select" },
      { type: "playPause" },
      { type: "swipe", direction: "bas" },
      { type: "drag", phase: "move", x: 1, y: 0, vx: 0, vy: 0 },
      { type: "hold", key: "select", phase: "start" },
      { type: "page", direction: "bas" },
    ];
    for (const intent of gestures) expect(heroRotationRearms(intent)).toBe(true);
    expect(heroRotationRearms({ type: "retour" })).toBe(false);
  });

  it("un maintien qui commence suspend ; sa suite (« Changed ») et sa fin libèrent", () => {
    expect(heroHoldAfter(false, { type: "hold", key: "select", phase: "start" })).toBe(true);
    expect(heroHoldAfter(true, { type: "hold", key: "select", phase: "update" })).toBe(false);
    expect(heroHoldAfter(true, { type: "hold", key: "droite", phase: "end" })).toBe(false);
    expect(heroHoldAfter(true, { type: "move", direction: "droite" })).toBe(true);
    expect(heroRotationArmed(true, false)).toBe(true);
    expect(heroRotationArmed(true, true)).toBe(false);
    expect(heroRotationArmed(false, false)).toBe(false);
  });

  it("le suivant, en boucle", () => {
    expect(nextHeroIndex(0, 5)).toBe(1);
    expect(nextHeroIndex(4, 5)).toBe(0);
    expect(nextHeroIndex(0, 0)).toBe(0);
  });
});

describe("le bord et le titre affiché", () => {
  it("le bord : le dernier bouton présent, sous deux titres aucun", () => {
    expect(heroEdgeKey(["hero:primary", "hero:secondary", "hero:list"], 5)).toBe("hero:list");
    expect(heroEdgeKey(["hero:primary", "hero:secondary", undefined], 5)).toBe("hero:secondary");
    expect(heroEdgeKey(["hero:primary", null, null], 2)).toBe("hero:primary");
    expect(heroEdgeKey(["hero:primary", "hero:secondary", "hero:list"], 1)).toBeNull();
  });

  it("le titre de la rotation dès que son art est réglé, sinon le précédent ; plus rien sans titre", () => {
    const settled = (id: string) => id !== "pending";
    expect(heroShown("a", "b", 3, settled)).toBe("b");
    expect(heroShown("a", "pending", 3, settled)).toBe("a");
    expect(heroShown(null, "pending", 3, settled)).toBeNull();
    expect(heroShown("a", null, 0, settled)).toBeNull();
  });
});
