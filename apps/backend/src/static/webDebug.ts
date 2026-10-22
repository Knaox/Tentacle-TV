import { closeSync, fstatSync, openSync, readFileSync } from "fs";
import { resolve } from "path";
import type { FastifyReply } from "fastify";
import { parseWebUiSwitch } from "./webUi";

/**
 * Le débogage du CLIENT WEB, allumé par l'administrateur :
 * `TENTACLE_WEB_DEBUG=on` (ou `1`, `true`). Coupé par défaut, sur toutes les
 * images — `:latest`, `:vX.Y.Z` comme `:dev` : aucune étiquette ni branche ne
 * l'allume d'elle-même.
 *
 * Allumé, le serveur marque la page du client web qu'il sert d'un attribut
 * sur `<html>` ; le client y lit la permission d'ouvrir ses outils (bouton
 * DEBUG, écran des nouveautés forcé, journal réseau — `apps/web/src/lib/
 * webDebug.ts`). Rien d'autre :
 *  - aucune route nouvelle, aucun secret : le débogage ne touche que l'interface ;
 *  - aucun script ajouté — un attribut ne demande rien à la politique de
 *    sécurité de la page ;
 *  - jamais le client des téléviseurs LG (`/tv`), jamais l'app de bureau, qui
 *    charge sa propre page, ni le mobile ou les TV natives, qui n'ont pas de page ;
 *  - aucun paramètre d'adresse ne l'allume : seul l'environnement du serveur.
 *
 * Coupé, rien ne change : la page part telle que construite, par
 * `@fastify/static`, avec ses en-têtes habituels.
 */

/**
 * ⚠️ Nom d'attribut qui traverse le réseau : le client web le lit
 * (`apps/web/src/lib/webDebug.ts`, même valeur). Ne jamais le renommer d'un
 * seul côté.
 */
export const WEB_DEBUG_ATTRIBUTE = "data-tentacle-web-debug";

/** La variable d'environnement : `on`, `1`, `true` (et leurs variantes de `webUi.ts`) l'allument. */
export function resolveWebDebug(env: NodeJS.ProcessEnv): boolean {
  return parseWebUiSwitch(env.TENTACLE_WEB_DEBUG) === true;
}

/** Pose le drapeau sur la balise `<html>` — une page sans elle repart intacte. */
export function injectWebDebugFlag(html: string): string {
  if (html.includes(`${WEB_DEBUG_ATTRIBUTE}=`)) return html;
  return html.replace(/<html(?=[\s>])/i, `<html ${WEB_DEBUG_ATTRIBUTE}="on"`);
}

/** Les chemins qui désignent directement la page du client web (le repli monopage passe ailleurs). */
export function isWebIndexPath(path: string): boolean {
  return path === "/" || path === "/index.html";
}

/**
 * L'envoi de la page marquée, relue seulement si le fichier a changé (un
 * rebuild du web en développement). `no-cache` et aucun validateur : la page
 * marquée ne doit jamais rester dans un cache une fois la variable retirée, ni
 * l'ancienne page servie en 304 une fois la variable posée.
 */
export function createWebIndexSender(webPath: string): (reply: FastifyReply) => FastifyReply {
  const file = resolve(webPath, "index.html");
  let cached: { mtimeMs: number; size: number; html: string } | null = null;
  const read = (): string => {
    // Le constat et la lecture portent sur le MÊME fichier ouvert : un rebuild
    // entre les deux ne mêle plus l'ancienne date au nouveau contenu.
    const fd = openSync(file, "r");
    try {
      const stat = fstatSync(fd);
      if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
        cached = { mtimeMs: stat.mtimeMs, size: stat.size, html: injectWebDebugFlag(readFileSync(fd, "utf8")) };
      }
      return cached.html;
    } finally {
      closeSync(fd);
    }
  };
  return (reply) =>
    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(read());
}
