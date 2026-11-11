import { describe, expect, it } from "vitest";
import { LIQUID_GLASS_DEFAULT_ON_MARK, LIQUID_GLASS_STORAGE_KEY, readLiquidGlass } from "./liquidGlass";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("le réglage Liquid Glass (1.50.0 : allumé d'office là où le verre existe)", () => {
  it("un Mac capable qui n'a jamais choisi : allumé, et rien n'est écrit pour le réglage", () => {
    const storage = memory();
    expect(readLiquidGlass(storage, true)).toBe(true);
    expect(storage.data.has(LIQUID_GLASS_STORAGE_KEY)).toBe(false);
    expect(storage.data.get(LIQUID_GLASS_DEFAULT_ON_MARK)).toBe("1");
  });

  it("un « coupé » d'avant la 1.50.0 est oublié une fois : le verre s'allume", () => {
    const storage = memory({ [LIQUID_GLASS_STORAGE_KEY]: "false" });
    expect(readLiquidGlass(storage, true)).toBe(true);
  });

  it("coupé APRÈS la bascule : il le reste d'un lancement à l'autre", () => {
    const storage = memory();
    readLiquidGlass(storage, true);
    storage.setItem(LIQUID_GLASS_STORAGE_KEY, "false");
    expect(readLiquidGlass(storage, true)).toBe(false);
    expect(readLiquidGlass(storage, true)).toBe(false);
    storage.setItem(LIQUID_GLASS_STORAGE_KEY, "true");
    expect(readLiquidGlass(storage, true)).toBe(true);
  });

  it("là où le verre n'existe pas : coupé d'office comme avant, rien n'est touché", () => {
    const storage = memory();
    expect(readLiquidGlass(storage, false)).toBe(false);
    expect(storage.data.size).toBe(0);
    expect(readLiquidGlass(memory({ [LIQUID_GLASS_STORAGE_KEY]: "true" }), false)).toBe(true);
  });
});
