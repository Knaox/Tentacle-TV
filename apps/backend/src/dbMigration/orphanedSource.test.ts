import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { LEGACY_DATA_MARKERS, orphanedLegacyInstallation } from "./orphanedSource";
import { migrationFailed, migrationFinished, publicDatabaseState } from "./migrationState";

let root: string;
let data: string;
let secrets: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tentacle-orphan-"));
  data = join(root, "data");
  secrets = join(root, "secrets");
  mkdirSync(data);
  mkdirSync(secrets);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  migrationFinished();
});

describe("une installation qui avait une MariaDB, plus configurée — jamais une base vide à sa place", () => {
  it("installation neuve (rien) : pas orpheline, la base naît", () => {
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("pile officielle mise à jour trop tôt : le secret db_password de l'ancienne pile la trahit", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
  });

  it("installation scellée (1.24+) sans base ni source : orpheline", () => {
    writeFileSync(join(data, "setup-complete"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
  });

  it("un volume d'une 1.23 sans source (ni scellé, ni secret) : orpheline, quel que soit le marqueur laissé", () => {
    const leftByOldServer: Record<string, string> = {
      compat: "compat/jellyfin.json",
      update: "update/server-latest.json",
      plugins: "plugins/installed.json",
      tools: "tools/yt-dlp",
    };
    for (const [marker, file] of Object.entries(leftByOldServer)) {
      const volume = join(root, `v-${marker}`);
      mkdirSync(join(volume, marker), { recursive: true });
      writeFileSync(join(volume, file), "{}");
      expect(orphanedLegacyInstallation(null, volume, secrets), marker).toBe(true);
    }
    expect(Object.keys(leftByOldServer).every((m) => (LEGACY_DATA_MARKERS as readonly string[]).includes(m))).toBe(true);
  });

  it("une installation neuve n'est JAMAIS prise pour orpheline : ce que l'entrypoint et la CLI posent avant la base n'en est pas un marqueur", () => {
    mkdirSync(join(data, "shared-deps"));
    writeFileSync(join(data, "shared-deps", "shared-deps.js"), "");
    writeFileSync(join(data, "web-ui"), "off\n");
    writeFileSync(join(data, "setup-token.txt"), "ABCD\n");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("start-fresh posé : plus jamais orpheline, marqueurs ou pas", () => {
    for (const marker of LEGACY_DATA_MARKERS) mkdirSync(join(data, marker));
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
    writeFileSync(join(data, "db-fresh-start"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("une source configurée (la migration s'en charge) ou une tentacle.db déjà là : pas orpheline", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    expect(orphanedLegacyInstallation("mysql://u:p@db/t", data, secrets)).toBe(false);
    for (const marker of LEGACY_DATA_MARKERS) mkdirSync(join(data, marker));
    writeFileSync(join(data, "tentacle.db"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("l'état public dit le motif, sans « nouvel essai » trompeur", () => {
    migrationFailed("source_missing", null);
    const db = publicDatabaseState();
    expect(db).toMatchObject({ state: "failed", reason: "source_missing" });
    expect("retryInSeconds" in db).toBe(false);
  });
});
