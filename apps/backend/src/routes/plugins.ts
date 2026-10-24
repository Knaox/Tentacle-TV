import type { FastifyPluginAsync } from "fastify";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { requireAdmin, requireAuth, type JellyfinUser } from "../middleware/auth";
import type { InstalledPlugin } from "../services/pluginManager";
import { isIsolatedPlugin } from "../plugins/runtime/runtimeRegistry";
import { mayUseIsolatedPlugin } from "../plugins/runtime/accountRights";
import {
  getInstalled,
  isValidPluginId,
  assertPathUnderDataDir,
  DATA_DIR,
} from "../services/pluginManager";
import { isPluginUsable, usablePlugins } from "../services/pluginStorage/gate";
import { readTabMeta, type PluginTabMeta } from "./pluginTabMeta";
import { readSearchMeta, type PluginSearchMeta } from "./pluginSearchMeta";
import { readTitlesMeta, type PluginTitlesMeta } from "./pluginTitlesMeta";
import { readPluginMusicManifest, type PluginMusicManifest } from "./pluginMusicMeta";
import { registerPluginRuntimeAdminRoutes } from "./pluginRuntimeAdmin";
// L'administration, découpée par sujet — ce fichier ne garde que ce que
// chaque client lit (dépendances partagées, plugins actifs, bundles).
import { registerPluginSourceRoutes } from "./pluginSources";
import { registerPluginInstalledRoutes } from "./pluginInstalled";
import { registerPluginConfigRoutes } from "./pluginConfig";
import { registerPluginSetupRoutes } from "./pluginSetup/pluginSetupRoutes";

/** Les extensions, moins les ISOLÉES que ce compte n'a pas le droit d'employer (plugins/runtime/accountRights.ts). */
async function withoutForbiddenIsolated(plugins: InstalledPlugin[], user: JellyfinUser | undefined): Promise<InstalledPlugin[]> {
  const kept = await Promise.all(
    plugins.map(async (p) => (!isIsolatedPlugin(p.pluginId) || (user && (await mayUseIsolatedPlugin(p.pluginId, user))) ? p : null)),
  );
  return kept.filter((p): p is InstalledPlugin => p !== null);
}

// ── Route registration ──
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  // Shared dependencies bundle (React, ReactDOM, TQ, i18next) — no auth needed
  // DATA_DIR = data/plugins/, shared-deps is at data/shared-deps/
  const sharedDepsPath = resolve(DATA_DIR, "..", "shared-deps", "shared-deps.js");
  let sharedDepsCache: string | null = null;

  app.get("/shared-deps.js", { config: { compress: false } }, async (_request, reply) => {
    if (!existsSync(sharedDepsPath)) {
      return reply.status(404).send({ message: "Shared deps not built. Run: pnpm build:shared-deps" });
    }
    if (!sharedDepsCache) {
      sharedDepsCache = readFileSync(sharedDepsPath, "utf-8");
    }
    const isDev = process.env.NODE_ENV !== "production";
    reply
      .header("Cache-Control", isDev ? "no-cache" : "public, max-age=86400, immutable")
      .type("application/javascript")
      .send(sharedDepsCache);
  });

  // Tailwind CSS runtime (inlined in plugin iframes to avoid CORS/CSP issues in Tauri)
  const tailwindPath = resolve(DATA_DIR, "..", "shared-deps", "tailwind.js");
  let tailwindCache: string | null = null;

  app.get("/tailwind.js", { config: { compress: false } }, async (_request, reply) => {
    if (!existsSync(tailwindPath)) {
      return reply.status(404).send({ message: "tailwind.js not found in data/shared-deps/" });
    }
    if (!tailwindCache) {
      tailwindCache = readFileSync(tailwindPath, "utf-8");
    }
    reply
      .header("Cache-Control", "public, max-age=604800, immutable")
      .type("application/javascript")
      .send(tailwindCache);
  });

  app.get("/active", { preHandler: requireAuth }, async (request) => {
    // Une extension que ce serveur refuse (pluginStorage/gate.ts) n'existe pas pour les clients : jamais à moitié.
    // Une extension ISOLÉE que ce compte n'a pas le droit d'employer non plus : rien d'elle, navigation comprise.
    const active = await withoutForbiddenIsolated(usablePlugins(), (request as { user?: JellyfinUser }).user);
    return active.map((p) => {
      const pluginDir = resolve(DATA_DIR, p.pluginId);
      let navItems: unknown[] = [];
      // L'onglet mobile de l'extension (icône, libellés) — cf. pluginTabMeta.
      let tab: PluginTabMeta | undefined;
      // La recherche hors bibliothèque que le plugin sait mener — cf. pluginSearchMeta.
      let search: PluginSearchMeta | undefined;
      // Ce que le plugin sait dire et faire d'un titre hors bibliothèque — cf. pluginTitlesMeta.
      let titles: PluginTitlesMeta | undefined;
      // Les points d'extension de la musique (Octave) — cf. pluginMusicMeta.
      let music: PluginMusicManifest | null = null;
      const manifestPath = resolve(pluginDir, "plugin.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          if (Array.isArray(manifest.navItems)) navItems = manifest.navItems;
          tab = readTabMeta(manifest);
          search = readSearchMeta(manifest);
          titles = readTitlesMeta(manifest);
          music = readPluginMusicManifest(manifest.music);
        } catch { /* ignore malformed manifest */ }
      }
      const configEnabled = (p.config as Record<string, unknown>)?.enabled === true;
      return {
        id: p.id, pluginId: p.pluginId, name: p.name, version: p.version,
        hasBundle: existsSync(resolve(pluginDir, "dist")),
        // Only expose regular navItems when plugin is configured; admin navItems always visible
        navItems: configEnabled
          ? navItems
          : navItems.filter((n: any) => n.admin),
        configEnabled,
        tab,
        // Comme les pages : une intégration éteinte ne cherche rien.
        ...(configEnabled && search ? { search } : {}),
        ...(configEnabled && titles ? { titles } : {}),
        ...(configEnabled && music ? { music } : {}),
      };
    });
  });

  app.get("/:pluginId/bundle", { preHandler: requireAuth, config: { compress: false } }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    if (!isValidPluginId(pluginId)) {
      return reply.status(400).send({ message: "Invalid plugin ID" });
    }
    // Le code d'une extension qui ne sert pas (désactivée, refusée par ce
    // serveur) n'est pas servi : les clients ne le demandent que d'après
    // /active — jamais à moitié (pluginStorage/gate.ts).
    const installed = getInstalled().find((p) => p.pluginId === pluginId);
    if (!installed || !isPluginUsable(installed)) {
      return reply.status(404).send({ message: "Bundle not found" });
    }
    // Comme dans /active : une extension isolée n'existe pas pour un compte sans droit.
    if ((await withoutForbiddenIsolated([installed], (request as { user?: JellyfinUser }).user)).length === 0) {
      return reply.status(404).send({ message: "Bundle not found" });
    }
    const bundlePath = resolve(DATA_DIR, pluginId, "dist", `plugin-${pluginId}.iife.js`);
    assertPathUnderDataDir(bundlePath);
    if (!existsSync(bundlePath)) {
      return reply.status(404).send({ message: "Bundle not found" });
    }
    reply.type("application/javascript").send(readFileSync(bundlePath));
  });

  await app.register(async (admin) => {
    admin.addHook("preHandler", requireAdmin);
    registerPluginSourceRoutes(admin);
    registerPluginInstalledRoutes(admin);
    registerPluginConfigRoutes(admin);
    // Le runtime isolé : état du processus, outils permis par l'administrateur.
    registerPluginRuntimeAdminRoutes(admin);
    // Le formulaire générique que déclare un plugin (`setup` de son manifeste).
    registerPluginSetupRoutes(admin);
  });
};
