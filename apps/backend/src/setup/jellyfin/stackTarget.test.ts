import { describe, expect, it, vi } from "vitest";

vi.mock("../setupStore", () => ({ claimedAdminId: () => null }));

import { SetupError } from "../setupErrors";
import { designatesSibling, probeTarget, type TargetDeps } from "./stackTarget";

const ids: Record<string, string> = {
  "http://jellyfin:8096": "pile",
  "http://172.16.1.30:47896": "pile",
  "http://172.16.1.30:8096": "salon",
};

function deps(over: Partial<TargetDeps> = {}): TargetDeps & { asserted: number } {
  const d = {
    asserted: 0,
    siblingUrl: "http://jellyfin:8096",
    probe: async (url: string) => {
      if (!ids[url]) throw new SetupError("jf_unreachable");
      return { url, id: ids[url], version: "10.11.11", serverName: "x", blank: false, compatible: true };
    },
    assertSibling: async () => void (d.asserted += 1),
    ...over,
  };
  return d;
}

describe("le Jellyfin visé par l'assistant", () => {
  it("rien de demandé, ou l'adresse interne : celui de la pile, après la preuve « même réseau »", async () => {
    expect(designatesSibling("", "http://jellyfin:8096")).toBe(true);
    expect(designatesSibling("HTTP://Jellyfin:8096/", "http://jellyfin:8096")).toBe(true);
    const d = deps();
    expect(await probeTarget("http://jellyfin:8096", d)).toMatchObject({ inStack: true, probed: { url: "http://jellyfin:8096" } });
    expect(d.asserted).toBe(1);
  });

  it("le Jellyfin de la pile vu par son port publié : c'est lui, joint par son adresse interne", async () => {
    expect(await probeTarget("http://172.16.1.30:47896", deps())).toMatchObject({ inStack: true, probed: { url: "http://jellyfin:8096", id: "pile" } });
  });

  it("un autre Jellyfin : choisi tel quel, même si celui de la pile ne répond pas", async () => {
    expect(await probeTarget("http://172.16.1.30:8096", deps())).toMatchObject({ inStack: false, probed: { url: "http://172.16.1.30:8096", id: "salon" } });
    const down = deps({ probe: async (url) => (url.includes("jellyfin:") ? Promise.reject(new SetupError("jf_unreachable")) : deps().probe(url)) });
    expect(await probeTarget("http://172.16.1.30:8096", down)).toMatchObject({ inStack: false });
  });

  it("sans pile complète : l'adresse choisie, rien d'autre", async () => {
    const d = deps({ siblingUrl: null });
    expect(await probeTarget("http://172.16.1.30:8096", d)).toMatchObject({ inStack: false });
    expect(d.asserted).toBe(0);
  });
});
