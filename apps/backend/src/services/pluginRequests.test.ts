import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterAll, describe, expect, it, vi } from "vitest";

// Un vrai dossier de données, lu par pluginManager dès son import.
const dataRoot = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? "/tmp"}/tentacle-demandes-${process.pid}-${Date.now()}`;
  process.env.TENTACLE_DATA_DIR = dir;
  return dir;
});

import { forgetRequestExtension, hasRequestExtension } from "./pluginRequests";
import { familyCapability } from "./family/familyConfig";

const pluginsDir = join(dataRoot, "plugins");
const REQUESTS = { titles: { state: "/titles/state", request: "/titles/request" } };

interface Fixture {
  pluginId: string;
  enabled?: boolean;
  configured?: boolean;
  manifest?: unknown;
}

function install(plugins: Fixture[]): void {
  rmSync(pluginsDir, { recursive: true, force: true });
  mkdirSync(pluginsDir, { recursive: true });
  const installed = plugins.map((p) => ({
    id: `id-${p.pluginId}`, pluginId: p.pluginId, sourceId: "banc", name: p.pluginId, version: "1.0.0",
    enabled: p.enabled ?? true, config: { enabled: p.configured ?? true }, installedAt: "2026-10-04T00:00:00Z",
  }));
  writeFileSync(join(pluginsDir, "installed.json"), JSON.stringify(installed));
  for (const p of plugins) {
    if (p.manifest === undefined) continue;
    mkdirSync(join(pluginsDir, p.pluginId), { recursive: true });
    writeFileSync(join(pluginsDir, p.pluginId, "plugin.json"), typeof p.manifest === "string" ? p.manifest : JSON.stringify(p.manifest));
  }
  forgetRequestExtension();
}

afterAll(() => rmSync(dataRoot, { recursive: true, force: true }));

describe("une extension sait-elle demander un titre ?", () => {
  it("non, sans extension", () => {
    install([]);
    expect(hasRequestExtension()).toBe(false);
  });

  it("oui, dès qu'une extension active et configurée déclare la demande — quel que soit son nom", () => {
    install([{ pluginId: "demandes-maison", manifest: REQUESTS }]);
    expect(hasRequestExtension()).toBe(true);
  });

  it("non : sans route de demande, éteinte, pas configurée, ou au manifeste illisible", () => {
    const cases: Fixture[] = [
      { pluginId: "etat-seul", manifest: { titles: { state: "/titles/state" } } },
      { pluginId: "eteinte", enabled: false, manifest: REQUESTS },
      { pluginId: "pas-configuree", configured: false, manifest: REQUESTS },
      { pluginId: "illisible", manifest: "{ pas du json" },
      { pluginId: "sans-manifeste" },
    ];
    for (const fixture of cases) {
      install([fixture]);
      expect(hasRequestExtension(), fixture.pluginId).toBe(false);
    }
  });

  it("se relit au plus toutes les 30 s", () => {
    install([]);
    expect(hasRequestExtension(1_000)).toBe(false);
    install([{ pluginId: "demandes", manifest: REQUESTS }]);
    hasRequestExtension(1_000);
    // Un changement sans `forget` attend la fin des 30 s.
    writeFileSync(join(pluginsDir, "installed.json"), "[]");
    expect(hasRequestExtension(20_000)).toBe(true);
    expect(hasRequestExtension(32_000)).toBe(false);
  });

  it("la capacité de la Famille ne propose « peut demander » qu'avec elle", () => {
    install([]);
    expect(familyCapability()).toMatchObject({ v: 2, guests: true, guestRequests: false });
    install([{ pluginId: "demandes", manifest: REQUESTS }]);
    expect(familyCapability()).toMatchObject({ guests: true, guestRequests: true });
  });
});
