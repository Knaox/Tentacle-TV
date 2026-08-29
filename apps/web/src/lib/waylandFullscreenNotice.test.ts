import { afterEach, describe, expect, it, vi } from "vitest";
import { fullscreenNoticeSeen, markFullscreenNoticeSeen } from "./waylandFullscreenNotice";

describe("waylandFullscreenNotice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne dit « déjà vu » qu'après marquage, et le retient", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    });
    expect(fullscreenNoticeSeen()).toBe(false);
    markFullscreenNoticeSeen();
    expect(fullscreenNoticeSeen()).toBe(true);
  });

  it("se tait quand le stockage est indisponible — l'avis ne doit pas boucler", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("indisponible");
      },
      setItem: () => {
        throw new Error("indisponible");
      },
    });
    // Sans mémoire possible, « déjà vu » : se taire vaut mieux que répéter.
    expect(fullscreenNoticeSeen()).toBe(true);
    expect(() => {
      markFullscreenNoticeSeen();
    }).not.toThrow();
  });
});
