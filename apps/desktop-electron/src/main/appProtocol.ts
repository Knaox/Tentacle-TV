/**
 * Service du build web sous un schéma dédié, plutôt que `file://`.
 *
 * La checklist Electron déconseille explicitement `file://` : son modèle
 * d'origine est trop permissif. Un schéma dédié, déclaré « privilégié », donne
 * un contexte sécurisé, une origine stable, et permet à la CSP de s'appliquer
 * normalement.
 */

import { app, net, protocol } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const APP_SCHEME = "tentacle";
export const APP_ORIGIN = `${APP_SCHEME}://app`;

/**
 * À appeler AVANT `app.whenReady()` — Electron l'exige pour les schémas
 * privilégiés.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** Racine du build web (`apps/web/dist`), empaquetée ou en développement. */
export function webRoot(): string {
  const packaged = path.join(process.resourcesPath, "web");
  if (app.isPackaged && existsSync(packaged)) return packaged;
  return path.resolve(__dirname, "../../../web/dist");
}

/**
 * Résout un chemin de requête à l'intérieur de la racine, ou `null`.
 *
 * Confinement strict : on normalise, puis on vérifie que le résultat est
 * bien SOUS la racine. Sans ce contrôle, `../../` sortirait du dossier — le
 * même piège que `safe_join` traite côté Rust aujourd'hui.
 */
export function resolveWithinRoot(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const candidate = path.resolve(root, decoded);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null;
  return candidate;
}

/** Branche le service des fichiers. À appeler après `app.whenReady()`. */
export function serveApp(): void {
  const root = webRoot();

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const resolved = resolveWithinRoot(root, url.pathname);

    if (resolved === null) {
      return new Response("chemin refuse", { status: 403 });
    }

    // Application monopage : toute route inconnue et sans extension rend
    // `index.html`, c'est le routeur React qui décide ensuite.
    const target =
      existsSync(resolved) && path.extname(resolved) !== ""
        ? resolved
        : path.join(root, "index.html");

    if (!existsSync(target)) {
      return new Response("introuvable", { status: 404 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}
