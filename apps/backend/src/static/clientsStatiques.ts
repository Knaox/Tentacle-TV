import { resolve, sep } from "path";
import { existsSync } from "fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

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
 */
export async function enregistrerClientsStatiques(app: FastifyInstance): Promise<void> {
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
