/**
 * La préparation tenue par le serveur, vue du téléphone (alpha mobile, 21/10) :
 * l'Allégé se lit sur `/prepared`, se reprend par plage là où il en était au
 * lieu de repartir de zéro, et le serveur est prié d'effacer sa préparation
 * une fois le fichier arrivé — ou annulé, jamais à une pause.
 *
 * Et l'ordre : le média est remis au pilote AVANT les à-côtés. Une extraction
 * de sous-titres qui traîne ne retient plus le transfert — sur l'iPhone, elle
 * le retenait jusqu'à la suspension du JavaScript, et il ne partait jamais.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { getFile } from "./queue";
import type { TransferNet, TransferStream } from "./transferNet";
import { CREDS, makeEngine, rootWithThreeItems, seed } from "./testkit";
import { mediaUrl, preparedReleaseUrl } from "./worker";
import type { FileRow } from "./store";

const PREPARE = { tag: "appareil-01" };

interface Seen {
  url: string;
  range: string | undefined;
}

/** Un serveur qui sert `/prepared` : il honore la plage, et note les effacements demandés. */
function preparedServer(content: string) {
  const opened: Seen[] = [];
  const released: string[] = [];
  const net: TransferNet = {
    async open(url, headers): Promise<TransferStream> {
      opened.push({ url, range: headers["Range"] });
      const start = headers["Range"] ? Number(/bytes=(\d+)-/.exec(headers["Range"])?.[1] ?? 0) : 0;
      return {
        status: start > 0 ? 206 : 200,
        header: () => null,
        chunks: (async function* () {
          yield new TextEncoder().encode(content.slice(start));
        })(),
      };
    },
    async killTranscode(url) {
      released.push(url);
    },
  };
  return { net, opened, released };
}

function lightFile(db: ReturnType<typeof openInMemory>, itemId: string): number {
  const fileId = seed(db, itemId, 1_000);
  db.prepare("UPDATE files SET variant = 'light', preset = 'p720', rel_path = ? WHERE id = ?").run(
    `media/${itemId}/light-ms1.mp4`,
    fileId,
  );
  return fileId;
}

describe("les adresses", () => {
  const file = { variant: "light", itemId: "item1", mediaSourceId: "ms1", preset: "p480", audioStreamIndex: 2, burnSubtitleIndex: null, sourcePath: null } as FileRow;

  it("sans préparation du serveur : le transcodage tiré en direct, comme avant", () => {
    expect(mediaUrl("https://s", file)).toBe("https://s/api/downloads/light/item1?mediaSourceId=ms1&preset=p480&audioStreamIndex=2");
  });

  it("avec : la préparation, l'étiquette de l'appareil, et l'adresse de son effacement", () => {
    expect(mediaUrl("https://s", file, PREPARE)).toBe(
      "https://s/api/downloads/prepared/item1?mediaSourceId=ms1&preset=p480&audioStreamIndex=2&tag=appareil-01",
    );
    expect(preparedReleaseUrl("https://s", file)).toBe("https://s/api/downloads/prepared/item1?mediaSourceId=ms1&preset=p480&audioStreamIndex=2");
  });

  it("l'Original ne passe jamais par la préparation", () => {
    expect(mediaUrl("https://s", { ...file, variant: "original" }, PREPARE)).toContain("/api/downloads/original/item1");
  });
});

describe("le moteur et la préparation du serveur", () => {
  it("un Allégé coupé reprend sa préparation par plage, puis la fait effacer", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = lightFile(db, "item1");
    // Un morceau déjà reçu avant la coupure (application tuée, réseau perdu).
    fs.writeFileSync(path.join(root, "media/item1/light-ms1.mp4.part"), "0123");
    const server = preparedServer("0123456789");
    const { engine } = makeEngine(db, root, server.net, { serverPrepare: () => PREPARE });

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("complete"));
    expect(server.opened[0]?.url).toContain("/api/downloads/prepared/item1");
    expect(server.opened[0]?.range).toBe("bytes=4-");
    expect(fs.readFileSync(path.join(root, "media/item1/light-ms1.mp4"), "utf8")).toBe("0123456789");
    expect(server.released).toEqual([preparedReleaseUrl(CREDS.serverUrl, getFile(db, fileId)!)]);
  });

  it("un morceau de la taille ESTIMÉE n'est pas pris pour un fichier complet", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = lightFile(db, "item1");
    db.prepare("UPDATE files SET expected_size = 4 WHERE id = ?").run(fileId);
    fs.writeFileSync(path.join(root, "media/item1/light-ms1.mp4.part"), "0123");
    const server = preparedServer("0123456789");
    const { engine } = makeEngine(db, root, server.net, { serverPrepare: () => PREPARE });
    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("complete"));
    expect(server.opened).toHaveLength(1);
    expect(fs.readFileSync(path.join(root, "media/item1/light-ms1.mp4"), "utf8")).toBe("0123456789");
  });

  it("sans la capacité, un Allégé repart de zéro et n'efface rien — le comportement d'avant", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = lightFile(db, "item1");
    fs.writeFileSync(path.join(root, "media/item1/light-ms1.mp4.part"), "0123");
    const server = preparedServer("abcdef");
    const { engine } = makeEngine(db, root, server.net);

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("complete"));
    expect(server.opened[0]?.url).toContain("/api/downloads/light/item1");
    expect(server.opened[0]?.range).toBeUndefined();
    expect(server.released).toEqual([]);
  });

  it("une pause ne fait rien effacer : la préparation continue pour la reprise", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = lightFile(db, "item1");
    let unblock: (() => void) | null = null;
    const released: string[] = [];
    const net: TransferNet = {
      async open(): Promise<TransferStream> {
        return {
          status: 200,
          header: () => null,
          chunks: (async function* () {
            await new Promise<void>((resolve) => (unblock = resolve));
            yield new Uint8Array([1]);
          })(),
        };
      },
      async killTranscode(url) {
        released.push(url);
      },
    };
    const { engine } = makeEngine(db, root, net, { serverPrepare: () => PREPARE });
    engine.start(CREDS);
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    engine.pause(fileId);
    unblock!();
    await vi.waitFor(() => expect(engine.isActive(fileId)).toBe(false));
    expect(released).toEqual([]);
  });

  it("le média part avant les à-côtés : une extraction de sous-titres qui traîne ne le retient pas", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = lightFile(db, "item1");
    db.prepare("UPDATE files SET subtitles_json = ? WHERE id = ?").run(
      JSON.stringify([{ index: 3, format: "srt", langTag: "fre" }]),
      fileId,
    );
    let subtitleAsked = false;
    const server = preparedServer("0123456789");
    const { engine } = makeEngine(db, root, server.net, {
      serverPrepare: () => PREPARE,
      // Le serveur met « une éternité » à extraire la piste.
      makeFetcher: () => () => {
        subtitleAsked = true;
        return new Promise<Uint8Array | null>(() => {});
      },
    });
    engine.start(CREDS);
    await vi.waitFor(() => expect(subtitleAsked).toBe(true));
    expect(server.opened).toHaveLength(1);
  });
});
