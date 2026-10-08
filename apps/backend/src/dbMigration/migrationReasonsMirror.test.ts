import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MIGRATION_FAILURE_REASONS } from "./migrationErrors";
import { WAITING_TEXT } from "./maintenance/waitingPageText";

// Les clients traduisent chaque motif (`DATABASE_MIGRATION_REASONS`, shared) : la
// liste du serveur ne peut pas en ajouter un qu'ils ne connaîtraient pas.
const SHARED = resolve(__dirname, "../../../../packages/shared/src/databaseMigration/databaseMigrationView.ts");

describe("motifs d'échec de la migration : la même liste partout", () => {
  it("le serveur et les clients ont exactement les mêmes motifs, dans le même ordre", () => {
    const source = readFileSync(SHARED, "utf8");
    const block = /DATABASE_MIGRATION_REASONS = \[([\s\S]*?)\] as const/.exec(source)![1];
    const shared = [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(shared).toEqual([...MIGRATION_FAILURE_REASONS]);
  });

  it("la page d'attente du serveur a une phrase pour chaque motif (ou la phrase « journal »), en FR et en EN", () => {
    for (const lang of ["fr", "en"] as const) {
      const reasons = WAITING_TEXT[lang].reasons as Record<string, string>;
      for (const reason of MIGRATION_FAILURE_REASONS) expect(reasons[reason] ?? reasons.other).toBeTruthy();
    }
  });
});
