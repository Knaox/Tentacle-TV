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
import { resolveRoot } from "./downloads/paths";
import { localDb } from "./localDb";
import { LOCAL_HOST, serveLocalAsset } from "./localAssets";
import { getPluginDocument, PLUGIN_HOST } from "./pluginDocuments";

export const APP_SCHEME = "tentacle";
export const APP_HOST = "app";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
/** Origine des ressources locales. À nommer dans la CSP — `'self'` ne la couvre pas. */
export const LOCAL_ORIGIN = `${APP_SCHEME}://${LOCAL_HOST}`;

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

/**
 * L'URL désigne-t-elle notre propre application ?
 *
 * ⚠️ NE PAS comparer `new URL(u).origin` à `APP_ORIGIN`. Les deux analyseurs
 * d'URL en présence ne s'accordent pas sur ce schéma :
 *
 *  - Chromium le connaît comme `standard` (cf. `registerAppScheme`) et lui
 *    donne une vraie origine, `tentacle://app` ;
 *  - l'analyseur de Node applique le WHATWG à la lettre : un schéma non
 *    spécial n'a pas d'origine tuple, et `.origin` vaut la chaîne `"null"`.
 *
 * Une comparaison sur `.origin` est donc TOUJOURS fausse côté processus
 * principal — elle refusait la totalité des commandes IPC et faisait passer
 * chaque navigation interne pour un lien externe.
 */
export function isAppOrigin(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST;
  } catch {
    return false;
  }
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

/**
 * Journal des requêtes servies, développement uniquement.
 *
 * Une ressource refusée au niveau du RÉSEAU (CORS, protocole en échec) ne
 * produit aucun message dans la console du rendu : l'écran reste noir sans le
 * moindre indice. Savoir si le bundle a seulement été DEMANDÉ tranche en une
 * exécution entre « rien ne se charge » et « tout se charge mais l'app se
 * trompe d'environnement ».
 */
function trace(requestPath: string, target: string, status: number): void {
  if (app.isPackaged) return;
  console.log(`[protocole] ${status} ${requestPath} -> ${path.basename(target)}`);
}

/**
 * Sert le document d'un greffon, ou 404.
 *
 * Le document est déposé par la page (`plugin_document_set`) et rendu ici sous
 * une origine distincte de celle de l'application, pour qu'il reçoive sa propre
 * politique de sécurité. Voir `pluginDocuments.ts`.
 */
function servePluginDocument(pathname: string): Response {
  const id = decodeURIComponent(pathname).replace(/^\/+/, "");
  const html = getPluginDocument(id);
  if (html === undefined) {
    trace(pathname, "", 404);
    return new Response("greffon inconnu", { status: 404 });
  }
  trace(pathname, `greffon:${id}`, 200);
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Sert une ressource téléchargée, en résolvant la racine ici.
 *
 * La résolution est faite par l'appelant et non par `localAssets` : ce dernier
 * n'importe alors ni `electron` ni la base, et se teste. Elle peut échouer —
 * racine pointée sur un disque externe débranché — et ça ne doit pas remonter
 * plus haut qu'un 404.
 */
async function serveLocalAssetFrom(request: Request, pathname: string): Promise<Response> {
  let root: string;
  try {
    root = resolveRoot(localDb(), app.getPath("userData"));
  } catch {
    return new Response("racine indisponible", { status: 404 });
  }
  return await serveLocalAsset(request, pathname, root, APP_ORIGIN);
}

/** Branche le service des fichiers. À appeler après `app.whenReady()`. */
export function serveApp(): void {
  const root = webRoot();

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);

    // Le schéma porte TROIS origines : l'application, les greffons, et les
    // ressources téléchargées. On aiguille sur l'hôte, sinon un document de
    // greffon serait cherché dans le build web et l'origine perdrait tout son
    // sens. Chacune a sa politique de sécurité et son confinement.
    if (url.host === PLUGIN_HOST) return servePluginDocument(url.pathname);
    if (url.host === LOCAL_HOST) {
      const response = await serveLocalAssetFrom(request, url.pathname);
      trace(`//${LOCAL_HOST}${url.pathname}`, url.pathname, response.status);
      return response;
    }

    const resolved = resolveWithinRoot(root, url.pathname);

    if (resolved === null) {
      trace(url.pathname, "", 403);
      return new Response("chemin refuse", { status: 403 });
    }

    // Une route d'API n'est JAMAIS servie par le repli monopage.
    //
    // Le backend Tentacle vit sur un serveur distant ; sous cette origine,
    // `/api/...` ne peut être qu'une erreur de configuration. Sans ce garde,
    // le repli répondait `index.html` avec un **HTTP 200** : le client
    // recevait du HTML là où il attendait du JSON, sans qu'aucun appel
    // n'échoue bruyamment. C'est ce qui a masqué une régression entière —
    // l'application se croyait déployée sur le web et personne ne protestait.
    // Mieux vaut un 404 franc qu'une page d'accueil déguisée en réponse.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      trace(url.pathname, "", 404);
      return new Response("route d'api hors de l'application", { status: 404 });
    }

    // Application monopage : toute route inconnue et sans extension rend
    // `index.html`, c'est le routeur React qui décide ensuite.
    const target =
      existsSync(resolved) && path.extname(resolved) !== ""
        ? resolved
        : path.join(root, "index.html");

    if (!existsSync(target)) {
      trace(url.pathname, target, 404);
      return new Response("introuvable", { status: 404 });
    }

    const response = await net.fetch(pathToFileURL(target).toString());
    trace(url.pathname, target, response.status);

    // Le schéma est déclaré `corsEnabled`, et Vite marque ses modules
    // `crossorigin` : la requête part donc en mode CORS même pour une même
    // origine. Sans cet en-tête, le module principal peut être rejeté sans
    // le moindre message — écran noir et console muette.
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", APP_ORIGIN);
    return new Response(response.body, { status: response.status, headers });
  });
}
