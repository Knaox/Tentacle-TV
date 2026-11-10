/**
 * Banc du lot « pg » (10/11) : un import de 100, 101, 1 000 et 9 000 titres contre un VRAI index SQLite (migrations
 * commitées, FTS5) de 20 000 titres, par le vrai chemin du cœur (`startImport` : rapprochement, création, relevé de
 * l'ordre de la source). Aucun réseau, aucun Jellyfin : la création de la playlist est simulée (instantanée), tout
 * le reste est réel. Mesure : durée jusqu'à la playlist créée (« affichable »), dont le rapprochement, mémoire.
 *
 *   pnpm --filter @tentacle-tv/backend exec tsx test/import-bench/run.ts [--library 20000] [--sizes 100,101,1000,9000]
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { libraryOf, playlistOf } from "./corpus";

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback;
};
const LIBRARY = Number(arg("library", "20000"));
const SIZES = arg("sizes", "100,101,1000,9000").split(",").map(Number);

async function main(): Promise<void> {
  const folder = mkdtempSync(join(tmpdir(), "pg1-import-bench-"));
  process.env.TENTACLE_DATA_DIR = folder;
  const { initPrisma, closeDatabase } = await import("../../src/services/db");
  const { upsertRows } = await import("../../src/music/index/indexStore");
  const { startImport, getImport, resetImportsForTests } = await import("../../src/music/playlistImport/importJobs");
  const { savePlaylistSource, readPlaylistSource } = await import("../../src/music/playlistSource/sourceStore");
  try {
    if (!(await initPrisma())) throw new Error("base introuvable");
    const library = libraryOf(LIBRARY);
    let t = performance.now();
    await upsertRows(library, 1);
    console.log(`index : ${LIBRARY} titres posés en ${Math.round(performance.now() - t)} ms`);
    const view = { userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set<string>() } as never;
    for (const size of SIZES) {
      resetImportsForTests();
      const playlist = playlistOf(library, size, 1 / 3);
      const heap = process.memoryUsage().heapUsed;
      let created = 0;
      let createdAt = 0;
      t = performance.now();
      const started = startImport("u1", { input: { kind: "playlist", playlist }, name: null, keepEmpty: true }, {
        fetcher: async () => {
          throw new Error("aucun réseau");
        },
        view: async () => view,
        create: async (_u, _n, ids) => {
          created = ids.length;
          createdAt = performance.now();
          return { ok: true, value: `${size}`.padStart(32, "a") };
        },
        remember: savePlaylistSource,
        explain: async () => [],
      });
      if (!started.ok) throw new Error("import refusé");
      let matchedAt = 0;
      const watch = setInterval(() => {
        const job = getImport("u1", started.jobId);
        if (!matchedAt && job && job.stage !== "reading" && job.stage !== "matching") matchedAt = performance.now();
      }, 5);
      await started.done;
      clearInterval(watch);
      const doneAt = performance.now();
      const job = getImport("u1", started.jobId)!;
      const kept = await readPlaylistSource(`${size}`.padStart(32, "a"));
      const mem = (process.memoryUsage().heapUsed - heap) / 1024 / 1024;
      console.log(
        `${String(size).padStart(5)} titres : ${job.stage}, ${created} dans la bibliothèque, ${job.result?.absent.length ?? 0} absents ` +
          `| rapprochement ${Math.round((matchedAt || createdAt) - t)} ms | playlist créée à ${Math.round(createdAt - t)} ms ` +
          `| fini (ordre gardé : ${kept?.slots.length ?? 0} rangs) à ${Math.round(doneAt - t)} ms | tas +${mem.toFixed(1)} Mo`,
      );
    }
  } finally {
    await closeDatabase();
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
