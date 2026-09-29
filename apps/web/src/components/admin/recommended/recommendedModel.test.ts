/**
 * Les extensions recommandées : où une extension en est, lu dans la liste des
 * installés et le catalogue sans rien savoir d'elle ; et son formulaire
 * `setup` — champ fautif, secret gardé, verdict dans les mots du plugin.
 */

import { describe, expect, it } from "vitest";
import { readPluginSetupMeta, type PluginSetupMeta } from "@tentacle-tv/shared";
import type { InstalledPlugin, MarketplacePlugin } from "../../admin-plugins/types";
import { fieldProblem, resultMessage, trimValues } from "./pluginSetupModel";
import { adminPathOf, mainPathOf, recommendedStatus } from "./recommendedPlugins";

const entry = { pluginId: "seer", name: "Vigie", version: "1.18.0" } as MarketplacePlugin;
const plugin = (patch: Partial<InstalledPlugin> = {}): InstalledPlugin => ({
  id: "uuid",
  pluginId: "seer",
  name: "Vigie",
  version: "1.18.0",
  sourceId: "official",
  enabled: true,
  config: {},
  installedAt: "t",
  navItems: [
    { path: "/discover", icon: "compass", platforms: ["web", "desktop"] },
    { path: "/admin/plugins/seer", icon: "settings", platforms: ["web"], admin: true },
  ],
  ...patch,
});

describe("où en est une extension recommandée", () => {
  const lists = (installed?: InstalledPlugin[], catalog?: MarketplacePlugin[], catalogFailed = false) => ({ installed, catalog, catalogFailed });

  it("absente : installable si une source la publie, introuvable sinon", () => {
    expect(recommendedStatus("seer", lists([], [entry]))).toEqual({ kind: "missing", entry });
    expect(recommendedStatus("seer", lists([], []))).toEqual({ kind: "not-found" });
    expect(recommendedStatus("seer", lists([], undefined, true))).toEqual({ kind: "catalog-error" });
    expect(recommendedStatus("seer", lists(undefined, [entry]))).toEqual({ kind: "loading" });
  });

  it("installée : coupée, en attente de redémarrage, en échec, à brancher, prête — dans cet ordre", () => {
    expect(recommendedStatus("seer", lists([plugin({ enabled: false, restartRequired: true })])).kind).toBe("disabled");
    expect(recommendedStatus("seer", lists([plugin({ restartRequired: true })])).kind).toBe("restart");
    expect(recommendedStatus("seer", lists([plugin({ serverModule: { state: "failed" } })])).kind).toBe("failed");
    expect(recommendedStatus("seer", lists([plugin({ config: { url: "http://x" } })])).kind).toBe("setup");
    expect(recommendedStatus("seer", lists([plugin({ config: { enabled: true } })])).kind).toBe("ready");
  });

  it("ses pages, d'après son manifeste", () => {
    expect(adminPathOf(plugin())).toBe("/admin/plugins/seer");
    expect(mainPathOf(plugin())).toBe("/discover");
    expect(adminPathOf(plugin({ navItems: [] }))).toBeNull();
  });
});

const META = readPluginSetupMeta({
  fields: [
    { key: "url", kind: "url", required: true, label: { fr: "Adresse", en: "Address" } },
    { key: "apiKey", kind: "secret", required: true, label: { fr: "Clé", en: "Key" } },
  ],
  test: "/admin/test-connection",
  success: { fr: "Connecté à Jellyseerr {{version}}", en: "Connected to Jellyseerr {{version}}" },
  errors: { "invalid-key": { fr: "Clé refusée", en: "Key rejected" } },
}) as PluginSetupMeta;

describe("formulaire d'une extension", () => {
  const [url, apiKey] = META.fields;

  it("un champ requis vide, une adresse qui n'en est pas une", () => {
    expect(fieldProblem(url, " ", false)).toBe("required");
    expect(fieldProblem(url, "jellyseerr:5055", false)).toBe("invalid");
    expect(fieldProblem(url, "http://jellyseerr:5055", false)).toBeNull();
  });

  it("un secret déjà enregistré peut rester vide", () => {
    expect(fieldProblem(apiKey, "", true)).toBeNull();
    expect(fieldProblem(apiKey, "", false)).toBe("required");
    expect(trimValues({ url: " http://a ", apiKey: "" })).toEqual({ url: "http://a", apiKey: "" });
  });

  it("le verdict dans les mots du plugin, version comprise", () => {
    expect(resultMessage(META, { ok: true, error: null, version: "2.7.3", saved: true }, "fr")).toEqual({ text: "Connecté à Jellyseerr 2.7.3" });
    expect(resultMessage(META, { ok: true, error: null, version: null, saved: false }, "en")).toEqual({ text: "Connected to Jellyseerr" });
    expect(resultMessage(META, { ok: false, error: "invalid-key", version: null, saved: false }, "fr")).toEqual({ text: "Clé refusée" });
  });

  it("sinon ceux de Tentacle : module pas chargé, ou échec inconnu", () => {
    expect(resultMessage(META, { ok: false, error: "plugin-not-running", version: null, saved: false }, "fr")).toEqual({ key: "setupNotRunning" });
    expect(resultMessage(META, { ok: false, error: "weird", version: null, saved: false }, "fr")).toEqual({ key: "setupFailed" });
    const bare = { ...META, success: null };
    expect(resultMessage(bare, { ok: true, error: null, version: "2.7.3", saved: false }, "fr")).toEqual({ key: "setupOkVersion", values: { version: "2.7.3" } });
  });
});
