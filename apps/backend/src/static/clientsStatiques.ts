import { resolve, sep } from "path";
import { existsSync } from "fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import {
  agentEstUnTeleviseur,
  chemineVersLeClientTv,
  clientTvOuvertATous,
} from "./agentTeleviseur";

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
 * S'y ajoute, en production, le filtre d'agent d'`agentTeleviseur.ts` : `/tv`
 * n'est servi qu'à un téléviseur. Ce n'en est pas la protection — le module le
 * dit franchement — mais l'assurance qu'un ordinateur ne se retrouve pas dans
 * une interface de salon.
 */
export async function enregistrerClientsStatiques(app: FastifyInstance): Promise<void> {
  // Posé AVANT toute inscription : un hook de l'instance parente vaut pour les
  // routes des plugins enregistrés ensuite, l'inverse n'étant pas vrai. C'est
  // ce qui le fait porter à la fois sur les fichiers statiques et sur le repli
  // monopage plus bas.
  app.addHook("onRequest", async (request, reply) => {
    const chemin = request.url.split("?")[0];
    if (!chemineVersLeClientTv(chemin)) return;
    if (clientTvOuvertATous()) return;
    if (agentEstUnTeleviseur(request.headers["user-agent"])) return;
    // 404 et non 403 : l'adresse ne doit pas se confirmer elle-même à qui la
    // cherche. Un navigateur de bureau y voit une page qui n'existe pas.
    return reply.status(404).send({ message: "Not found" });
  });

  const cheminWeb = resolve(__dirname, "../../../web/dist");
  const webPresent = existsSync(cheminWeb);
  if (webPresent) {
    await app.register(fastifyStatic, { root: cheminWeb, prefix: "/" });
  }

  // Avant le premier build de la cible téléviseur, on sert `client/public` :
  // la page de diagnostic `/tv/sonde.html` y vit et doit être atteignable dès
  // l'installation de la coquille, sans rien avoir construit.
  const cheminTvBuild = resolve(__dirname, "../../../tv-webos/client/dist");
  const cheminTvSource = resolve(__dirname, "../../../tv-webos/client/public");
  const cheminTv = existsSync(cheminTvBuild) ? cheminTvBuild : cheminTvSource;
  const tvPresent = existsSync(cheminTv);
  if (tvPresent) {
    await app.register(fastifyStatic, {
      root: cheminTv,
      prefix: "/tv/",
      // `sendFile` a déjà été posé par l'inscription du client web ; le
      // décorer deux fois ferait échouer l'enregistrement.
      decorateReply: !webPresent,
      // Sans cela `@fastify/static` pose lui-même `public, max-age=0` et
      // écrase ce que `setHeaders` a écrit : tout le bundle serait
      // retéléchargé à chaque lancement de l'application.
      cacheControl: false,
      setHeaders(reponse, chemin) {
        // Vite nomme les ressources par empreinte : elles sont immuables et
        // peuvent être gardées indéfiniment. `index.html`, lui, désigne ces
        // noms — le garder en cache figerait le téléviseur sur une version
        // ancienne et annulerait tout l'intérêt de servir le client.
        if (chemin.includes(`${sep}assets${sep}`)) {
          reponse.setHeader("cache-control", "public, max-age=31536000, immutable");
        } else {
          reponse.setHeader("cache-control", "no-cache");
        }
      },
    });
  }

  if (!webPresent && !tvPresent) return;

  app.setNotFoundHandler(async (request, reply) => {
    const chemin = request.url.split("?")[0];
    if (chemin.startsWith("/api/")) {
      return reply.status(404).send({ message: "Not found" });
    }
    // Le repli du client téléviseur est cantonné à `/tv` : sans cela, une URL
    // profonde comme `/tv/settings` servirait le client web.
    if (tvPresent && (chemin === "/tv" || chemin.startsWith("/tv/"))) {
      return reply.sendFile("index.html", cheminTv);
    }
    if (!webPresent) {
      return reply.status(404).send({ message: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}
