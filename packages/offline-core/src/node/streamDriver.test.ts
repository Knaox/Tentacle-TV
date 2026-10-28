/**
 * Le pilote du bureau annonce le total dès les en-têtes : c'est ce qui donne une
 * barre à un fichier dont la taille n'était pas connue d'avance (un titre d'une
 * extension, `expectedSize: null`). Sans réponse qui le dise, rien n'est annoncé.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { nodeFiles } from "./nodeFiles";
import { nodePartWriter } from "./nodePartWriter";
import { announcedTotal, createStreamDriver } from "./streamDriver";
import { TransferFlags } from "../core/transfer";
import type { TransferNet } from "../core/transferNet";
import { preparedRoot } from "../core/testkit";

const headers = (values: Record<string, string>) => (name: string) => values[name] ?? null;

function serving(status: number, values: Record<string, string>, body = "abcdef"): TransferNet {
  return {
    async open() {
      return { status, header: headers(values), chunks: (async function* () { yield new Uint8Array(Buffer.from(body)); })() };
    },
    async killTranscode() {
      /* rien */
    },
  };
}

async function totals(net: TransferNet, resumeFrom = 0): Promise<number[]> {
  const root = preparedRoot("tentacle-driver-");
  const seen: number[] = [];
  await createStreamDriver(net, nodePartWriter, nodeFiles).download({
    url: "https://tv.exemple/api/plugins/x/music/offline/1",
    headers: {},
    partPath: path.join(root, "media", "a.part"),
    resumeFrom,
    signal: new TransferFlags(),
    onBytes: () => undefined,
    onTotal: (total) => seen.push(total),
  });
  return seen;
}

describe("announcedTotal", () => {
  it("206 : la fin de Content-Range ; 200 : Content-Length plus la reprise", () => {
    expect(announcedTotal(206, headers({ "content-range": "bytes 100-199/4404019", "content-length": "100" }), 100)).toBe(4404019);
    expect(announcedTotal(200, headers({ "content-length": "4404019" }), 0)).toBe(4404019);
    expect(announcedTotal(206, headers({ "content-length": "50" }), 10)).toBe(60);
  });

  it("rien d'annoncé sans longueur (transcodage tiré en direct), ni pour une valeur illisible", () => {
    expect(announcedTotal(200, headers({}), 0)).toBeNull();
    expect(announcedTotal(200, headers({ "content-length": "abc" }), 0)).toBeNull();
    expect(announcedTotal(200, headers({ "content-length": "0" }), 0)).toBeNull();
  });
});

describe("le pilote du bureau", () => {
  it("annonce le total d'un fichier servi en entier, avant le premier octet", async () => {
    expect(await totals(serving(200, { "content-length": "6" }))).toEqual([6]);
  });

  it("annonce le total d'une reprise (206) et d'un 200 qui ignore la plage (repart de zéro)", async () => {
    expect(await totals(serving(206, { "content-range": "bytes 4-9/10", "content-length": "6" }), 4)).toEqual([10]);
    expect(await totals(serving(200, { "content-length": "6" }), 4)).toEqual([6]);
  });

  it("n'annonce rien sans longueur, ni sur une erreur HTTP", async () => {
    expect(await totals(serving(200, {}))).toEqual([]);
    expect(await totals(serving(503, { "content-length": "20", "retry-after": "20" }))).toEqual([]);
  });
});
