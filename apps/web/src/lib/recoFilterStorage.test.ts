import { describe, expect, it } from "vitest";
import {
  RECO_FILTER_STORAGE_KEY,
  parseRecoFilterMirror,
  readRecoFilterMirror,
  serializeRecoFilterMirror,
  writeRecoFilterMirror,
} from "./recoFilterStorage";

describe("miroir du filtre de plateformes", () => {
  it("aller-retour, ids normalisés", () => {
    const raw = serializeRecoFilterMirror([415, 283, 283], "u1");
    expect(parseRecoFilterMirror(raw, "u1")).toEqual([283, 415]);
  });

  it("rien pour un autre compte, un JSON corrompu ou une absence", () => {
    const raw = serializeRecoFilterMirror([283], "u1");
    expect(parseRecoFilterMirror(raw, "u2")).toEqual([]);
    expect(parseRecoFilterMirror(raw, null)).toEqual([]);
    expect(parseRecoFilterMirror("{oops", "u1")).toEqual([]);
    expect(parseRecoFilterMirror(null, "u1")).toEqual([]);
  });

  it("lit et écrit dans le stockage fourni sous la clé historique", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    writeRecoFilterMirror([283], "u1", storage);
    expect(store.has(RECO_FILTER_STORAGE_KEY)).toBe(true);
    expect(readRecoFilterMirror("u1", storage)).toEqual([283]);
    expect(readRecoFilterMirror("u2", storage)).toEqual([]);
  });
});
