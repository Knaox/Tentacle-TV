import { describe, expect, it } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { listForUser } from "../core/listing";
import { setStatus } from "../core/queue";
import { reconcilePlayback } from "../core/reconcile";
import { claimOrCreateFile } from "../core/store";
import { spec } from "../core/testkit";
import { pickSeriesPlayTarget } from "./offlineHighlights";

/**
 * Défaut E du relevé, de bout en bout dans la base locale : une série gardée
 * sur la machine et regardée AILLEURS. Sans l'état du serveur, « Reprendre »
 * choisit l'épisode 1 ; une fois rapproché, l'épisode entamé ailleurs.
 */
describe("« Reprendre » d'une série vue ailleurs", () => {
  function keptSeries() {
    const db = openInMemory();
    for (const episode of [1, 2, 3, 4]) {
      const itemId = `e${episode}`;
      const { fileId } = claimOrCreateFile(db, spec({ itemId, mediaSourceId: `ms${episode}`, relPath: `media/${itemId}/o.mkv` }));
      setStatus(db, fileId, "complete", null, 1_000);
      db.prepare(
        `INSERT INTO item_meta (item_id, kind, series_id, series_name, title, index_number, parent_index_number, created_at, updated_at)
         VALUES (?, 'episode', 'serie', 'Une série', ?, ?, 1, 1, 1)`,
      ).run(itemId, `Épisode ${episode}`, episode);
    }
    return db;
  }

  it("part de l'épisode 1 tant que la base locale ne sait rien", () => {
    const db = keptSeries();
    expect(pickSeriesPlayTarget(listForUser(db, "u"))?.itemId).toBe("e1");
  });

  it("reprend l'épisode entamé ailleurs une fois l'état du serveur appliqué", () => {
    const db = keptSeries();
    const changed = reconcilePlayback(
      db,
      "u",
      [
        { itemId: "e1", played: true, positionTicks: 0, lastPlayedAtMs: 10_000 },
        { itemId: "e2", played: true, positionTicks: 0, lastPlayedAtMs: 20_000 },
        { itemId: "e3", played: false, positionTicks: 7_000, lastPlayedAtMs: 30_000 },
        { itemId: "e4", played: false, positionTicks: 0, lastPlayedAtMs: null },
      ],
      [],
      50_000,
    );
    expect(changed).toEqual(["e1", "e2", "e3"]);
    const target = pickSeriesPlayTarget(listForUser(db, "u"));
    expect(target?.itemId).toBe("e3");
    expect(target?.positionTicks).toBe(7_000);
  });

  it("passe au premier épisode non vu quand rien n'est entamé", () => {
    const db = keptSeries();
    reconcilePlayback(db, "u", [
      { itemId: "e1", played: true, positionTicks: 0, lastPlayedAtMs: 10_000 },
      { itemId: "e2", played: true, positionTicks: 0, lastPlayedAtMs: null },
    ], [], 50_000);
    expect(pickSeriesPlayTarget(listForUser(db, "u"))?.itemId).toBe("e3");
  });
});
