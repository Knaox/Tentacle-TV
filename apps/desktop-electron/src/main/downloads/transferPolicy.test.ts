/**
 * La politique du transfert SANS son mécanisme : un pilote simulé qui ne lit
 * aucun flux. C'est le décor du mobile — le téléchargeur natif n'y livre les
 * en-têtes qu'à la fin, ne pose le `.part` qu'à la fin sur iOS, et écrit le
 * corps d'une erreur là où on attendait le média. Le bureau, lui, se teste de
 * bout en bout dans `transfer.test.ts`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { TransferDriver, TransferOutcome, TransferRequest } from "./adapters";
import { nodeVolume } from "./node/nodeFiles";
import { run, TransferFlags, type TransferJob } from "./transfer";
import { preparedRoot } from "./testkit";

interface FakeDriver {
  driver: TransferDriver;
  requests: TransferRequest[];
  stops: string[];
}

function fake(behave: (request: TransferRequest) => TransferOutcome): FakeDriver {
  const state: FakeDriver = {
    requests: [],
    stops: [],
    driver: {
      async download(request) {
        state.requests.push(request);
        return behave(request);
      },
      async stopTranscode(url) {
        state.stops.push(url);
      },
    },
  };
  return state;
}

function job(root: string, partial: Partial<TransferJob> = {}): TransferJob {
  return {
    url: "https://tv.exemple/api/downloads/original/item1?mediaSourceId=ms1",
    token: "jeton",
    finalPath: path.join(root, "media", "item1", "original-ms1.mkv"),
    variant: "original",
    expectedSize: null,
    serverUrl: "https://tv.exemple",
    transcodeSession: null,
    ...partial,
  };
}

function seedPart(finalPath: string, content: string): void {
  mkdirSync(path.dirname(finalPath), { recursive: true });
  writeFileSync(`${finalPath}.part`, content);
}

const NOW = (): number => 1_000;
const NONE = (): null => null;

describe("politique seule", () => {
  it("la session choisie par le client arrete le transcodage quand aucun en-tete n'arrive", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root, {
      variant: "light",
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
      transcodeSession: { playSessionId: "cli-1", deviceId: "dev-1" },
    });
    const d = fake((request) => {
      writeFileSync(request.partPath, "abc");
      return { kind: "done", status: 200, header: NONE };
    });

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "complete", finalSize: 3 });
    expect(d.stops).toHaveLength(1);
    expect(d.stops[0]).toContain("playSessionId=cli-1");
    expect(readFileSync(target.finalPath, "utf8")).toBe("abc");
  });

  it("les en-tetes de reponse priment sur la session du client", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root, {
      variant: "light",
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
      transcodeSession: { playSessionId: "cli-1", deviceId: "dev-1" },
    });
    const headers: Record<string, string> = {
      "x-tentacle-play-session": "srv-2",
      "x-tentacle-device-id": "dev-2",
    };
    const d = fake((request) => {
      request.onHeaders?.(200, (name) => headers[name] ?? null);
      writeFileSync(request.partPath, "abc");
      return { kind: "done", status: 200, header: (name) => headers[name] ?? null };
    });

    await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(d.stops[0]).toContain("playSessionId=srv-2");
  });

  it("le pilote recoit la reprise, jamais l'en-tete Range", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root);
    seedPart(target.finalPath, "abcd");
    const d = fake((request) => {
      writeFileSync(request.partPath, "abcdef");
      return { kind: "done", status: 206, header: NONE };
    });

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(d.requests[0]?.resumeFrom).toBe(4);
    expect(d.requests[0]?.headers).toEqual({ Authorization: "Bearer jeton" });
    expect(end).toEqual({ kind: "complete", finalSize: 6 });
  });

  it("un Range ignore fait repartir de zero, en pause systeme", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root);
    seedPart(target.finalPath, "vieux");
    const d = fake(() => ({ kind: "failed", cause: "range-ignored", bytesKnown: 0 }));

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "failed", code: "network", bytesDone: 0 });
    expect(existsSync(`${target.finalPath}.part`)).toBe(false);
  });

  it("un corps d'erreur ecrit dans le .part est jete", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root);
    seedPart(target.finalPath, "abc");
    // Android ajoute le corps de la reponse au fichier, statut ou pas.
    const d = fake((request) => {
      writeFileSync(request.partPath, "abc<html>introuvable</html>");
      return { kind: "done", status: 404, header: NONE };
    });

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "failed", code: "unavailable", bytesDone: 0 });
    expect(existsSync(`${target.finalPath}.part`)).toBe(false);
  });

  it("une erreur HTTP sans ecriture garde le .part et sa reprise", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root);
    seedPart(target.finalPath, "abc");
    const d = fake(() => ({ kind: "done", status: 502, header: NONE }));

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "failed", code: "network", bytesDone: 3 });
    expect(readFileSync(`${target.finalPath}.part`, "utf8")).toBe("abc");
  });

  it("une pause sans .part sur le disque garde le compte du pilote", async () => {
    const root = preparedRoot("tentacle-policy-");
    const target = job(root);
    // iOS : rien sur le disque avant la fin, seule la progression est connue.
    const d = fake(() => ({ kind: "paused", bytesKnown: 42 }));

    const end = await run(d.driver, nodeVolume(root), target, new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "paused", bytesDone: 42 });
  });

  it("un pilote qui leve ne laisse pas le transfert sans verdict", async () => {
    const root = preparedRoot("tentacle-policy-");
    const d: FakeDriver = fake(() => {
      throw new Error("pilote casse");
    });

    const end = await run(d.driver, nodeVolume(root), job(root), new TransferFlags(), () => undefined, NOW);

    expect(end).toEqual({ kind: "failed", code: "io", bytesDone: 0 });
  });
});
