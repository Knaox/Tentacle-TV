import { resolve, sep } from "path";
import { existsSync } from "fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import {
  isTvUserAgent,
  isTvClientPath,
  tvClientOpenToAll,
} from "./tvUserAgent";

/**
 * Service des clients construits : le client web à la racine, le client
 * téléviseur sous `/tv`.
 *
 * Le paquet installé sur un téléviseur LG ne contient qu'une coquille — c'est
 * ce serveur qui sert le client. Mettre à jour Tentacle met donc à jour le
 * téléviseur, sans repasser par la revue du LG Content Store. Trois conditions
 * rendent cette propriété vraie, et elles sont toutes posées ici : les bons
 * en-têtes de cache, un repli SPA cantonné à `/tv`, et une inscription qui ne
 * décore `sendFile` qu'une seule fois.
 *
 * S'y ajoute, en production, le filtre d'agent d'`tvUserAgent.ts` : `/tv`
 * n'est servi qu'à un téléviseur. Ce n'en est pas la protection — le module le
 * dit franchement — mais l'assurance qu'un ordinateur ne se retrouve pas dans
 * une interface de salon.
 */
/** Racines de service, remplaçables par les tests (répertoires éphémères). */
export interface StaticClientRoots {
  webPath?: string;
  tvBuildPath?: string;
  tvSourcePath?: string;
}

export async function registerStaticClients(
  app: FastifyInstance,
  roots: StaticClientRoots = {},
): Promise<void> {
  // Posé AVANT toute inscription : un hook de l'instance parente vaut pour les
  // routes des plugins enregistrés ensuite, l'inverse n'étant pas vrai. C'est
  // ce qui le fait porter à la fois sur les fichiers statiques et sur le repli
  // monopage plus bas.
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!isTvClientPath(path)) return;
    if (tvClientOpenToAll()) return;
    if (isTvUserAgent(request.headers["user-agent"])) return;
    // 404 et non 403 : l'adresse ne doit pas se confirmer elle-même à qui la
    // cherche. Un navigateur de bureau y voit une page qui n'existe pas.
    return reply.status(404).send({ message: "Not found" });
  });

  const webPath = roots.webPath ?? resolve(__dirname, "../../../web/dist");
  const webPresent = existsSync(webPath);
  if (webPresent) {
    await app.register(fastifyStatic, { root: webPath, prefix: "/" });
  }

  // Avant le premier build de la cible téléviseur, on sert `client/public` :
  // la page de diagnostic `/tv/sonde.html` y vit et doit être atteignable dès
  // l'installation de la coquille, sans rien avoir construit.
  const tvBuildPath = roots.tvBuildPath ?? resolve(__dirname, "../../../tv-webos/client/dist");
  const tvSourcePath = roots.tvSourcePath ?? resolve(__dirname, "../../../tv-webos/client/public");
  // Le témoin d'un build est son `index.html`, pas le répertoire : un `dist`
  // VIDE (build interrompu, nettoyage partiel) masquait `public` et rendait
  // `/tv` entièrement muet — sonde comprise (mesuré le 30.08 en dev).
  const tvBuilt = existsSync(resolve(tvBuildPath, "index.html"));
  const tvPath = tvBuilt ? tvBuildPath : tvSourcePath;
  const tvPresent = existsSync(tvPath);
  if (tvPresent) {
    await app.register(fastifyStatic, {
      root: tvPath,
      prefix: "/tv/",
      // `sendFile` a déjà été posé par l'inscription du client web ; le
      // décorer deux fois ferait échouer l'enregistrement.
      decorateReply: !webPresent,
      // Sans cela `@fastify/static` pose lui-même `public, max-age=0` et
      // écrase ce que `setHeaders` a écrit : tout le bundle serait
      // retéléchargé à chaque lancement de l'application.
      cacheControl: false,
      setHeaders(response, path) {
        // Vite nomme les ressources par empreinte : elles sont immuables et
        // peuvent être gardées indéfiniment. `index.html`, lui, désigne ces
        // noms — le garder en cache figerait le téléviseur sur une version
        // ancienne et annulerait tout l'intérêt de servir le client.
        if (path.includes(`${sep}assets${sep}`)) {
          response.setHeader("cache-control", "public, max-age=31536000, immutable");
        } else {
          response.setHeader("cache-control", "no-cache");
        }
      },
    });
  }

  if (!webPresent && !tvPresent) return;

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/")) {
      return reply.status(404).send({ message: "Not found" });
    }
    // Le repli du client téléviseur est cantonné à `/tv` : sans cela, une URL
    // profonde comme `/tv/settings` servirait le client web.
    if (tvPresent && (path === "/tv" || path.startsWith("/tv/"))) {
      return reply.sendFile("index.html", tvPath);
    }
    if (!webPresent) {
      return reply.status(404).send({ message: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}
