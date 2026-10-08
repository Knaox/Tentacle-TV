import { afterAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * La détection d'une installation orpheline (`orphanedSource.ts`) tient à un
 * ordre : une 1.25 NEUVE ouvre `tentacle.db` avant d'écrire le moindre marqueur
 * d'un serveur d'avant. Si un module en posait un DÈS SON IMPORT, une
 * installation neuve se prendrait pour orpheline (écran d'attente, assistant
 * fermé) : ce test le garde, sur un dossier de données vide, comme au premier
 * démarrage. Les modules sont importés APRÈS avoir posé ce dossier.
 */
const dataDir = mkdtempSync(join(tmpdir(), "tentacle-markers-"));

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("aucun module n'écrit un marqueur d'ancien serveur à son import", () => {
  it("extensions, versions de Jellyfin et du serveur, yt-dlp, scellé de l'assistant : rien sur le disque avant la base", async () => {
    vi.stubEnv("TENTACLE_DATA_DIR", dataDir);
    const { DATA_ROOT } = await import("../services/dataDir");
    expect(DATA_ROOT).toBe(dataDir);
    await import("../services/pluginManager");
    await import("../services/pluginInstall");
    await import("../services/jellyfinCompat/compatService");
    await import("../services/serverUpdate/serverReleases");
    await import("../services/ytDlp");
    await import("../setup/setupLock");
    const { LEGACY_DATA_MARKERS } = await import("./orphanedSource");
    const created = existsSync(dataDir) ? readdirSync(dataDir) : [];
    expect(created.filter((name) => (LEGACY_DATA_MARKERS as readonly string[]).includes(name))).toEqual([]);
    expect(LEGACY_DATA_MARKERS.some((marker) => existsSync(join(dataDir, marker)))).toBe(false);
  });
});
