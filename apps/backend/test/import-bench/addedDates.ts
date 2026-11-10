/**
 * Banc du lot « pg » : la PREMIÈRE lecture d'une playlist importée de 9 000 titres date chacune de ses entrées
 * (`addedDatesFor`, rang dans la source) ; la deuxième ne réécrit rien. Base SQLite réelle et jetable.
 *   pnpm exec tsx test/import-bench/addedDates.ts
 */

import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
async function main() {
  process.env.TENTACLE_DATA_DIR = mkdtempSync(join(tmpdir(), "pg1-added-"));
  const { initPrisma, closeDatabase } = await import("../../src/services/db");
  const { addedDatesFor, playlistScope } = await import("../../src/music/listOrder/addedDates");
  await initPrisma();
  const ids = Array.from({ length: 9000 }, (_, i) => i.toString(16).padStart(32, "0"));
  const pinned = new Map(ids.map((id, i) => [id, 1_000_000 + i]));
  for (const round of [1, 2]) {
    const t = performance.now();
    const dates = await addedDatesFor(playlistScope("p".repeat(32)), ids, undefined, { ordered: true, pinned });
    console.log(`lecture ${round} : ${dates.size} dates en ${Math.round(performance.now() - t)} ms`);
  }
  await closeDatabase();
}
void main();
