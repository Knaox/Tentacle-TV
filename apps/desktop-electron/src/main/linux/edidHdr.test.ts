import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { edidSupportsHdr, hdrDisplayConnected } from "./edidHdr";

/** Un EDID de base suivi d'une extension CTA-861 portant `blocks` (blocs de données). */
function edidWith(blocks: number[][]): Buffer {
  const edid = Buffer.alloc(256);
  edid[126] = 1;
  edid[128] = 0x02;
  edid[129] = 0x03;
  let at = 132;
  for (const block of blocks) {
    for (const byte of block) edid[at++] = byte;
  }
  edid[130] = at - 128;
  return edid;
}

/** Bloc étendu (étiquette 7) « HDR Static Metadata » (6) avec ses fonctions de transfert. */
const hdrBlock = (eotf: number): number[] => [(7 << 5) | 3, 6, eotf, 0x01];
/** Un bloc audio quelconque, pour vérifier qu'on saute bien les blocs. */
const audioBlock = [(1 << 5) | 3, 0x09, 0x07, 0x07];

describe("edidSupportsHdr", () => {
  it("un écran qui annonce PQ est HDR", () => {
    expect(edidSupportsHdr(edidWith([audioBlock, hdrBlock(0b0101)]))).toBe(true);
  });

  it("HLG seul suffit aussi", () => {
    expect(edidSupportsHdr(edidWith([hdrBlock(0b1001)]))).toBe(true);
  });

  it("un bloc HDR qui n'annonce que le gamma SDR n'est pas HDR", () => {
    expect(edidSupportsHdr(edidWith([hdrBlock(0b0001)]))).toBe(false);
  });

  it("sans extension CTA, ou EDID tronqué : pas HDR, et pas d'exception", () => {
    expect(edidSupportsHdr(Buffer.alloc(128))).toBe(false);
    expect(edidSupportsHdr(Buffer.alloc(10))).toBe(false);
    expect(edidSupportsHdr(edidWith([audioBlock]))).toBe(false);
  });
});

describe("hdrDisplayConnected", () => {
  function drm(entries: Record<string, { status: string; edid: Buffer }>): string {
    const root = mkdtempSync(path.join(tmpdir(), "drm-"));
    for (const [name, { status, edid }] of Object.entries(entries)) {
      mkdirSync(path.join(root, name));
      writeFileSync(path.join(root, name, "status"), `${status}\n`);
      writeFileSync(path.join(root, name, "edid"), edid);
    }
    return root;
  }

  it("ne compte que les écrans BRANCHÉS", () => {
    const root = drm({
      "card1-DP-1": { status: "disconnected", edid: edidWith([hdrBlock(0b0100)]) },
      "card1-HDMI-A-1": { status: "connected", edid: edidWith([audioBlock]) },
    });
    expect(hdrDisplayConnected(root)).toBe(false);
  });

  it("un seul écran HDR branché suffit", () => {
    const root = drm({
      "card1-DP-1": { status: "connected", edid: edidWith([audioBlock]) },
      "card1-DP-2": { status: "connected", edid: edidWith([hdrBlock(0b0100)]) },
    });
    expect(hdrDisplayConnected(root)).toBe(true);
  });

  it("dossier absent : pas HDR", () => {
    expect(hdrDisplayConnected("/chemin/qui/n/existe/pas")).toBe(false);
  });
});
