import { afterEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ current: null as object | null }));
vi.mock("../theme/liquidGlassMode", () => ({ readNativeGlassBridge: () => bridge.current }));

const { readClientTraits } = await import("./clientTraits");

describe("traits de l'appareil pour l'écran des nouveautés", () => {
  afterEach(() => {
    bridge.current = null;
  });

  it("sans verre natif (web, Windows, Linux, macOS d'avant 26) : aucun trait", () => {
    expect([...readClientTraits()]).toEqual([]);
  });

  it("le pont annonce le verre natif : `liquidGlass`", () => {
    bridge.current = { supported: true };
    expect([...readClientTraits()]).toEqual(["liquidGlass"]);
  });
});
