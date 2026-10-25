import { execFileSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { DATA_DIR } from "./pluginManager";
import { extractPlugin } from "./pluginInstall";

/**
 * Le dossier de données d'une extension ISOLÉE (`data/` : sa base, son cache)
 * survit à sa mise à jour, et une archive ne lui en apporte jamais un — ni à
 * l'installation, ni à la mise à jour (un `data/` d'archive pourrait cacher un lien).
 */

const ID = "isolated-update-test";
const MANIFEST = JSON.stringify({ id: ID, storage: { sqlite: true }, runtime: { kind: "isolated", entry: "server/index.mjs" } });

function archive(version: string): string {
  const src = mkdtempSync(join(tmpdir(), "tentacle-archive-"));
  mkdirSync(join(src, "server"), { recursive: true });
  mkdirSync(join(src, "data"), { recursive: true });
  writeFileSync(join(src, "plugin.json"), MANIFEST);
  writeFileSync(join(src, "server", "index.mjs"), `// ${version}`);
  writeFileSync(join(src, "data", "plugin.db"), "BASE DE L'ARCHIVE");
  const out = join(mkdtempSync(join(tmpdir(), "tentacle-tgz-")), `${ID}.tar.gz`);
  execFileSync("tar", ["-czf", out, "-C", src, "plugin.json", "server", "data"]);
  rmSync(src, { recursive: true, force: true });
  return out;
}

const pluginDir = join(DATA_DIR, ID);

afterEach(() => rmSync(pluginDir, { recursive: true, force: true }));

describe("mise à jour d'une extension isolée", () => {
  it("à l'installation, le data/ de l'archive est écarté", async () => {
    await extractPlugin(archive("1.0.0"), ID);
    expect(readFileSync(join(pluginDir, "server", "index.mjs"), "utf8")).toBe("// 1.0.0");
    expect(existsSync(join(pluginDir, "data"))).toBe(false);
  });

  it("à la mise à jour, le data/ en place est gardé tel quel, celui de l'archive jamais posé", async () => {
    await extractPlugin(archive("1.0.0"), ID);
    mkdirSync(join(pluginDir, "data", "cache"), { recursive: true });
    writeFileSync(join(pluginDir, "data", "plugin.db"), "BASE DU SERVEUR");
    writeFileSync(join(pluginDir, "data", "cache", "titre.flac"), "audio");
    await extractPlugin(archive("1.1.0"), ID);
    expect(readFileSync(join(pluginDir, "server", "index.mjs"), "utf8")).toBe("// 1.1.0");
    expect(readFileSync(join(pluginDir, "data", "plugin.db"), "utf8")).toBe("BASE DU SERVEUR");
    expect(readFileSync(join(pluginDir, "data", "cache", "titre.flac"), "utf8")).toBe("audio");
    expect(existsSync(join(DATA_DIR, `.${ID}.data-keep`))).toBe(false);
  });
});
