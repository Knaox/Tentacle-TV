/**
 * La réparation de l'espace occupé : recaler la base sur le disque, et balayer
 * ce qui n'a plus de propriétaire.
 *
 * Celui qui compte : un side-car de sous-titres ne doit JAMAIS être pris pour
 * un orphelin. Il vit dans `subs/`, que `listFiles` n'atteint pas — mais rien
 * ne le dit dans le code du balayage, alors ce test le dit.
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openInMemory } from "../node/nodeDatabase";
import { nodeVolume } from "../node/nodeFiles";
import { getFile } from "./queue";
import { claimOrCreateFile } from "./store";
import { diskUsage, repairUsage } from "./usage";
import { rootWithThreeItems, spec, writeMedia } from "./testkit";

const NOTHING = { skipFileIds: new Set<number>(), removeOrphans: true };

/** Une ligne `complete` qui annonce `bytesDone` octets. */
function completed(db: ReturnType<typeof openInMemory>, bytesDone: number): number {
  const fileId = claimOrCreateFile(
    db,
    spec({ itemId: "item1", relPath: "media/item1/original-ms1.mkv", expectedSize: null }),
  ).fileId;
  db.prepare("UPDATE files SET status = 'complete', bytes_done = ? WHERE id = ?").run(bytesDone, fileId);
  return fileId;
}

describe("recalage sur le disque", () => {
  it("un fichier plus gros que ce que dit la base recale l'espace occupe", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    // Le cas reel : un remux rate laissait 884 Mo comptes pour 76.
    const fileId = completed(db, 76);
    writeMedia(root, "media/item1/original-ms1.mkv", "x".repeat(884));

    const report = repairUsage(db, nodeVolume(root), 5_000, NOTHING);

    expect(report.rebased).toBe(1);
    expect(getFile(db, fileId)?.bytesDone).toBe(884);
    expect(diskUsage(db)).toBe(884);
  });

  it("un fichier disparu passe en defaut et cesse d'occuper la place", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = completed(db, 500);

    const report = repairUsage(db, nodeVolume(root), 5_000, NOTHING);

    expect(report.missing).toBe(1);
    const file = getFile(db, fileId);
    expect(file?.status).toBe("error");
    expect(file?.errorCode).toBe("missing");
    expect(diskUsage(db)).toBe(0);
  });

  it("un transfert vivant n'est pas mesure : son fichier grossit encore", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = completed(db, 76);
    writeMedia(root, "media/item1/original-ms1.mkv", "x".repeat(884));

    const report = repairUsage(db, nodeVolume(root), 5_000, {
      skipFileIds: new Set([fileId]),
      removeOrphans: true,
    });

    expect(report.rebased).toBe(0);
    expect(getFile(db, fileId)?.bytesDone).toBe(76);
  });
});

describe("balayage des dossiers", () => {
  it("le temporaire d'une finalisation interrompue part, la source reste", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    completed(db, 3);
    writeMedia(root, "media/item1/original-ms1.mkv", "abc");
    writeMedia(root, "media/item1/original-ms1.mkv.finalizing", "moitie");

    const report = repairUsage(db, nodeVolume(root), 5_000, NOTHING);

    expect(report.removed).toBe(1);
    const volume = nodeVolume(root);
    expect(volume.files.exists(path.join(root, "media", "item1", "original-ms1.mkv"))).toBe(true);
    expect(volume.files.exists(path.join(root, "media", "item1", "original-ms1.mkv.finalizing"))).toBe(false);
  });

  it("le .part d'un transfert en pause EST la reprise : on n'y touche pas", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = completed(db, 40);
    db.prepare("UPDATE files SET status = 'paused' WHERE id = ?").run(fileId);
    writeMedia(root, "media/item1/original-ms1.mkv.part", "x".repeat(40));

    const report = repairUsage(db, nodeVolume(root), 5_000, NOTHING);

    expect(report.removed).toBe(0);
    expect(nodeVolume(root).files.exists(path.join(root, "media", "item1", "original-ms1.mkv.part"))).toBe(true);
  });

  it("un media sans ligne est un orphelin, mais seulement si on l'autorise", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    completed(db, 3);
    writeMedia(root, "media/item1/original-ms1.mkv", "abc");
    writeMedia(root, "media/item1/light-ms1-p720.mp4", "reste d'une suppression");

    const volume = nodeVolume(root);
    const orphelin = path.join(root, "media", "item1", "light-ms1-p720.mp4");
    expect(repairUsage(db, volume, 5_000, { skipFileIds: new Set(), removeOrphans: false }).removed).toBe(0);
    expect(volume.files.exists(orphelin)).toBe(true);

    expect(repairUsage(db, volume, 5_000, NOTHING).removed).toBe(1);
    expect(volume.files.exists(orphelin)).toBe(false);
  });

  it("un side-car de sous-titres n'est jamais pris pour un orphelin", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    completed(db, 3);
    writeMedia(root, "media/item1/original-ms1.mkv", "abc");
    mkdirSync(path.join(root, "media", "item1", "subs"), { recursive: true });
    const sous = path.join(root, "media", "item1", "subs", "fre.vtt");
    writeFileSync(sous, "WEBVTT");

    repairUsage(db, nodeVolume(root), 5_000, NOTHING);

    expect(nodeVolume(root).files.exists(sous)).toBe(true);
  });
});
