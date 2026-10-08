import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { migrateUntilDone, STATUS_HEARTBEAT_MS } from "./migrationLoop";
import { MigrationFailure } from "./migrationErrors";
import { migrationFinished } from "./migrationState";

const dir = mkdtempSync(join(tmpdir(), "tentacle-loop-"));
afterEach(() => migrationFinished());

describe("les essais de migration", () => {
  it("pendant l'attente d'un essai, le fichier d'état bat : la CLI voit un serveur vivant", async () => {
    let clock = 1_000_000;
    const beats: number[] = [];
    const statusFile = join(dir, "status.json");
    let attempts = 0;
    await migrateUntilDone(
      async () => {
        if (++attempts === 1) throw new MigrationFailure("source_unreachable", "x");
        return { kind: "already" };
      },
      {
        statusFile,
        triggerFile: join(dir, "trigger"),
        log: () => undefined,
        delays: [30_000],
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          beats.push(JSON.parse(readFileSync(statusFile, "utf8")).updatedAt);
        },
      },
    );
    // Trente secondes d'attente : au moins deux battements, chacun plus récent.
    const distinct = [...new Set(beats)];
    expect(distinct.length).toBeGreaterThanOrEqual(2);
    expect(distinct.at(-1)! - distinct[0]).toBeGreaterThanOrEqual(STATUS_HEARTBEAT_MS);
    rmSync(dir, { recursive: true, force: true });
  });
});
