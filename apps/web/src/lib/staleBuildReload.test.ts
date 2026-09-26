import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isModuleLoadFailure, reloadForStaleBuild } from "./staleBuildReload";

describe("staleBuildReload — une page d'avant la mise à jour recharge", () => {
  const reload = vi.fn();
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    reload.mockReset();
    vi.stubGlobal("window", { location: { reload } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reconnaît l'échec d'un import dynamique, pas une erreur ordinaire", () => {
    expect(isModuleLoadFailure(new TypeError("Failed to fetch dynamically imported module: /tv/assets/Watch-x.js"))).toBe(true);
    expect(isModuleLoadFailure(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isModuleLoadFailure(new Error("Invalid token"))).toBe(false);
  });

  it("recharge une fois, puis laisse l'erreur remonter pendant 30 s", () => {
    expect(reloadForStaleBuild()).toBe(true);
    expect(reloadForStaleBuild()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
