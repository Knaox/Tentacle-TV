import { describe, expect, it } from "vitest";
import type { Intent } from "../input/keys";
import {
  directionOf, holdDirection, HOLD_KEYS, isBaseIntent, REMOTE_INTENT_TYPES,
  type HoldKey, type RemoteIntent, type RemoteIntentType,
} from "./intents";

/**
 * Le vocabulaire étendu ne doit RIEN casser de l'ancien : la LG lit
 * `Intent` dans ses tables de touches. Ces vérifications sont d'abord des
 * vérifications de TYPAGE — `pnpm typecheck` échoue si l'une d'elles casse —
 * doublées de quelques assertions pour que le test ait un corps.
 */

// Toute intention d'origine est une intention étendue.
const legacy: Intent[] = [
  { type: "move", direction: "haut" },
  { type: "select" },
  { type: "retour" },
  { type: "transport", command: "lecture" },
];
const widened: RemoteIntent[] = legacy;

// La liste des types couvre tout le vocabulaire, et rien d'autre.
type Listed = (typeof REMOTE_INTENT_TYPES)[number];
const exhaustive: [Exclude<RemoteIntentType, Listed>] extends [never] ? true : false = true;
const noExtra: [Exclude<Listed, RemoteIntentType>] extends [never] ? true : false = true;

// Les touches maintenables aussi.
const holdKeysExhaustive: [Exclude<HoldKey, (typeof HOLD_KEYS)[number]>] extends [never] ? true : false = true;

describe("vocabulaire des intentions", () => {
  it("reprend les quatre intentions d'origine telles quelles", () => {
    expect(widened.every(isBaseIntent)).toBe(true);
    expect(exhaustive && noExtra && holdKeysExhaustive).toBe(true);
  });

  it("ne compte comme intention d'origine aucune des nouvelles", () => {
    const added: RemoteIntent[] = [
      { type: "playPause" },
      { type: "hold", key: "select", phase: "start" },
      { type: "swipe", direction: "gauche" },
      { type: "drag", phase: "move", x: 1, y: 0, vx: 0, vy: 0 },
      { type: "page", direction: "bas" },
    ];
    expect(added.some(isBaseIntent)).toBe(false);
  });

  it("garde un type par intention, sans doublon", () => {
    expect(new Set(REMOTE_INTENT_TYPES).size).toBe(REMOTE_INTENT_TYPES.length);
  });
});

describe("directionOf", () => {
  it("rend la direction d'un pas et d'un glisser rapide", () => {
    expect(directionOf({ type: "move", direction: "bas" })).toBe("bas");
    expect(directionOf({ type: "swipe", direction: "droite" })).toBe("droite");
  });

  it("ne voit pas de geste « vers » dans un maintien, une page ni un glisser continu", () => {
    expect(directionOf({ type: "hold", key: "gauche", phase: "start" })).toBeNull();
    expect(directionOf({ type: "page", direction: "haut" })).toBeNull();
    expect(directionOf({ type: "drag", phase: "start", x: 0, y: 0, vx: 0, vy: 0 })).toBeNull();
    expect(directionOf({ type: "select" })).toBeNull();
  });
});

describe("holdDirection", () => {
  it("rend la direction d'une flèche maintenue, rien pour OK ni Lecture/Pause", () => {
    expect(holdDirection("droite")).toBe("droite");
    expect(holdDirection("select")).toBeNull();
    expect(holdDirection("playPause")).toBeNull();
  });
});
