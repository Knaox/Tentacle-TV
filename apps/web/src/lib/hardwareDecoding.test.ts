import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mpvHwdecValue, setHardwareDecoding, type HardwareDecoding } from "./hardwareDecoding";

/**
 * Le choix vit dans `localStorage`, absent de l'environnement de test — sans
 * lui, `hardwareDecodingChoice()` retombe sur « auto » et les cas ne se
 * distinguent plus. La clé `tentacle_hw_decode` n'est pas un identifiant : elle
 * est traversée par une chaîne, et ne se renomme pas.
 */
const store = new Map<string, string>();
beforeAll(() =>
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }),
);

const choose = (c: HardwareDecoding) => setHardwareDecoding(c);
afterEach(() => choose("auto"));

describe("mpvHwdecValue", () => {
  it("macOS n'a qu'un décodeur matériel, et il se nomme", () => {
    choose("auto");
    expect(mpvHwdecValue("macos")).toBe("videotoolbox");
  });

  it("« copie mémoire » a son équivalent macOS — le défaut d'import y existe aussi", () => {
    // C'est la sortie de secours d'un zéro-copie qui échoue : sur macOS il
    // traverse `VK_EXT_metal_objects` puis MoltenVK avant d'atteindre Metal.
    choose("copy");
    expect(mpvHwdecValue("macos")).toBe("videotoolbox-copy");
    expect(mpvHwdecValue("linux")).toBe("auto-safe-copy");
    expect(mpvHwdecValue("other")).toBe("auto-safe-copy");
  });

  it("« logiciel » coupe le décodage matériel partout", () => {
    choose("off");
    for (const p of ["macos", "linux", "other"] as const) {
      expect(mpvHwdecValue(p)).toBe("no");
    }
  });

  it("Linux garde nvdec devant vaapi, et lui seul", () => {
    choose("auto");
    expect(mpvHwdecValue("linux")).toBe("nvdec,vaapi,auto-safe");
    expect(mpvHwdecValue("other")).toBe("auto-safe");
  });
});
