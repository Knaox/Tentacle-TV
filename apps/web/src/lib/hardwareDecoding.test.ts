import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activeDecoder,
  decoderIsSoftware,
  mpvHwdecValue,
  rememberActiveDecoder,
  setHardwareDecoding,
  type HardwareDecoding,
} from "./hardwareDecoding";

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
    removeItem: (k: string) => void store.delete(k),
  }),
);

const choose = (c: HardwareDecoding) => setHardwareDecoding(c);
afterEach(() => {
  choose("auto");
  store.delete("tentacle_hw_decode_active");
});

describe("le decodeur reellement employe", () => {
  it("ne sait rien tant qu'aucune lecture n'a eu lieu", () => {
    expect(activeDecoder()).toBeNull();
  });

  it("retient ce que mpv rapporte, et le rend aux Préférences", () => {
    rememberActiveDecoder("videotoolbox");
    expect(activeDecoder()).toBe("videotoolbox");
    expect(decoderIsSoftware(activeDecoder())).toBe(false);
  });

  it("reconnaît le repli logiciel — c'est tout l'objet de la mesure", () => {
    // mpv rend `no` quand le matériel n'a pas su lire le flux : l'AV1 sur un Mac
    // Intel, le HEVC 10 bits sur un iGPU ancien. La lecture se déroule
    // normalement, et rien d'autre ne le dit.
    rememberActiveDecoder("no");
    expect(decoderIsSoftware(activeDecoder())).toBe(true);
  });

  it("ignore une valeur vide plutôt que d'effacer ce qu'on savait", () => {
    rememberActiveDecoder("videotoolbox");
    rememberActiveDecoder(null);
    rememberActiveDecoder("");
    expect(activeDecoder()).toBe("videotoolbox");
  });
});

describe("mpvHwdecValue", () => {
  it("macOS essaie l'import direct, puis la copie mémoire — jamais le logiciel en silence", () => {
    // Une valeur unique dont l'import échoue (mpv#12675, Mac Intel) ferait
    // décoder le processeur : la liste garde le décodeur matériel, au prix
    // d'une copie par image.
    choose("auto");
    expect(mpvHwdecValue("macos")).toBe("videotoolbox,videotoolbox-copy");
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
