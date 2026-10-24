import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
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
import { locateSharedDep, type SharedDepName } from "../services/pluginSharedDeps/sharedDepsLocator";
import { readTabMeta, type PluginTabMeta } from "./pluginTabMeta";
import { readSearchMeta, type PluginSearchMeta } from "./pluginSearchMeta";
import { readTitlesMeta, type PluginTitlesMeta } from "./pluginTitlesMeta";
import { readPluginMusicManifest, type PluginMusicManifest } from "./pluginMusicMeta";
import { readRuntimeManifest } from "../plugins/runtime/runtimeManifest";
import type { ClientFetchManifest } from "../plugins/runtime/pluginClientFetch";
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

/** Une entrée `admin: true` du manifeste : une page d'administration de l'extension. */
function isAdminNavItem(item: unknown): boolean {
  return typeof item === "object" && item !== null && Boolean((item as { admin?: unknown }).admin);
}

// ── Route registration ──
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  // Les dépendances partagées (React, ReactDOM, TQ, i18next) et Tailwind (inliné dans les
  // iframes : ni CORS ni CSP à négocier sur les coquilles) — sans authentification. Où les
  // trouver : services/pluginSharedDeps. Introuvables, c'est une panne du SERVEUR (500) :
  // un 404 se lisait « serveur trop ancien » sur la page de l'extension.
  const sharedDepsCache = new Map<SharedDepName, string>();
  const serveSharedDep = (name: SharedDepName, cacheControl: string) =>
    async (_request: FastifyRequest, reply: FastifyReply) => {
      let code = sharedDepsCache.get(name);
      if (code === undefined) {
        const path = await locateSharedDep(name);
        if (!path) {
          return reply.status(500).send({ message: `${name} introuvable sur ce serveur. Run: pnpm build:shared-deps` });
        }
        code = readFileSync(path, "utf-8");
        sharedDepsCache.set(name, code);
      }
      return reply.header("Cache-Control", cacheControl).type("application/javascript").send(code);
    };

  const isDev = process.env.NODE_ENV !== "production";
  app.get("/shared-deps.js", { config: { compress: false } },
    serveSharedDep("shared-deps.js", isDev ? "no-cache" : "public, max-age=86400, immutable"));
  app.get("/tailwind.js", { config: { compress: false } },
    serveSharedDep("tailwind.js", "public, max-age=604800, immutable"));

  app.get("/active", { preHandler: requireAuth }, async (request) => {
    // Une extension que ce serveur refuse (pluginStorage/gate.ts) n'existe pas pour les clients : jamais à moitié.
    // Une extension ISOLÉE que ce compte n'a pas le droit d'employer non plus : rien d'elle, navigation comprise.
    const user = (request as { user?: JellyfinUser }).user;
    const active = await withoutForbiddenIsolated(usablePlugins(), user);
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
      // Les hôtes que le BUREAU joint et lit en direct pour elle (requêtes déléguées) — le principal Electron
      // les lit ICI lui-même, jamais par la page.
      let clientFetch: ClientFetchManifest | null = null;
      const manifestPath = resolve(pluginDir, "plugin.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          if (Array.isArray(manifest.navItems)) navItems = manifest.navItems;
          tab = readTabMeta(manifest);
          search = readSearchMeta(manifest);
          titles = readTitlesMeta(manifest);
          music = readPluginMusicManifest(manifest.music);
          const runtime = readRuntimeManifest(manifest);
          clientFetch = runtime?.clientFetch && runtime.hostApi?.includes("client") ? runtime.clientFetch : null;
        } catch { /* ignore malformed manifest */ }
      }
      const configEnabled = (p.config as Record<string, unknown>)?.enabled === true;
      return {
        id: p.id, pluginId: p.pluginId, name: p.name, version: p.version,
        hasBundle: existsSync(resolve(pluginDir, "dist")),
        // Une entrée d'ADMINISTRATION ne part qu'à un administrateur, configurée ou non (c'est elle
        // qui la règle) ; les autres, seulement une fois l'extension configurée.
        navItems: navItems.filter((n) => (isAdminNavItem(n) ? user?.isAdmin === true : configEnabled)),
        configEnabled,
        tab,
        // Comme les pages : une intégration éteinte ne cherche rien.
        ...(configEnabled && search ? { search } : {}),
        ...(configEnabled && titles ? { titles } : {}),
        ...(configEnabled && music ? { music } : {}),
        ...(configEnabled && clientFetch ? { clientFetch } : {}),
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
