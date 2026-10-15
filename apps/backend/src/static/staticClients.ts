import { resolve, sep } from "path";
import { existsSync } from "fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  isTvUserAgent,
  isTvClientPath,
  tvClientOpenToAll,
} from "./tvUserAgent";
import { isSetupComplete } from "../services/configStore";
import { isWebUiEnabled, webUiBlocks } from "./webUi";
import { INVITE_PAGE_PATH, sendInvitePage } from "./invitePage";
import { sendSharePage, sharePageToken } from "./sharePage";
import { createWebIndexSender, isWebIndexPath, resolveWebDebug } from "./webDebug";

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
/**
 * Le 404 d'une PAGE : corps vide. Chrome, Edge et les autres Chromium
 * affichent alors leur propre page (« Cette page est introuvable — HTTP ERROR
 * 404 ») ; un corps, même `{"message":"Not found"}`, s'affiche tel quel, comme
 * le texte d'une page. Firefox et Safari montrent une page blanche. L'API
 * garde son JSON : ce sont les applications qui la lisent.
 */
function pageNotFound(reply: FastifyReply) {
  return reply.status(404).send();
}

/** Racines de service, remplaçables par les tests (répertoires éphémères). */
export interface StaticClientRoots {
  webPath?: string;
  tvBuildPath?: string;
  tvSourcePath?: string;
  /** L'interface web ouverte, et l'installation finie (`webUi.ts`) — remplaçables par les tests. */
  webUi?: () => { enabled: boolean; setupComplete: boolean };
  /** Le débogage du client web (`TENTACLE_WEB_DEBUG`, `webDebug.ts`) — remplaçable par les tests. */
  webDebug?: boolean;
}

export async function registerStaticClients(
  app: FastifyInstance,
  roots: StaticClientRoots = {},
): Promise<void> {
  // Posé AVANT toute inscription : un hook de l'instance parente vaut pour les
  // routes des plugins enregistrés ensuite, l'inverse n'étant pas vrai. C'est
  // ce qui le fait porter à la fois sur les fichiers statiques et sur le repli
  // monopage plus bas.
  const webUi = roots.webUi ?? (() => ({ enabled: isWebUiEnabled(), setupComplete: isSetupComplete() }));
  // La page du web MARQUÉE, si l'administrateur a allumé le débogage du web —
  // posée plus bas, une fois le client web trouvé. Sinon `null` : la page part
  // telle quelle, comme toujours.
  let sendWebIndex: ((reply: FastifyReply) => FastifyReply) | null = null;
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    // L'interface web coupée (`TENTACLE_WEB_UI=off`) : 404, sauf l'API, /tv, /.well-known et l'assistant.
    // Le lien d'invitation et les liens de partage mènent alors aux pages autonomes du serveur,
    // sans rien du client web.
    if (webUiBlocks(path, webUi())) {
      if (path === INVITE_PAGE_PATH && request.method === "GET") return sendInvitePage(request, reply);
      const shareToken = request.method === "GET" ? sharePageToken(path) : null;
      if (shareToken) return sendSharePage(request, reply, shareToken);
      return pageNotFound(reply);
    }
    if (sendWebIndex && (request.method === "GET" || request.method === "HEAD") && isWebIndexPath(path)) {
      return sendWebIndex(reply);
    }
    if (!isTvClientPath(path)) return;
    if (tvClientOpenToAll()) return;
    if (isTvUserAgent(request.headers["user-agent"])) return;
    // 404 et non 403 : l'adresse ne doit pas se confirmer elle-même à qui la
    // cherche. Un navigateur de bureau y voit une page qui n'existe pas.
    return pageNotFound(reply);
  });

  const webPath = roots.webPath ?? resolve(__dirname, "../../../web/dist");
  const webPresent = existsSync(webPath);
  if (webPresent) {
    await app.register(fastifyStatic, { root: webPath, prefix: "/" });
    if (roots.webDebug ?? resolveWebDebug(process.env)) sendWebIndex = createWebIndexSender(webPath);
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
    if (!webPresent) return pageNotFound(reply);
    // Interface web coupée : un fichier ABSENT d'un chemin toujours servi
    // (`/avatars/…`, `/tentacle-logo…`, `/.well-known/…`) n'est pas une route
    // du client — jamais sa page en repli.
    const { enabled, setupComplete } = webUi();
    if (!enabled && setupComplete) return pageNotFound(reply);
    // Une page de partage est publique, pas publiée : qui a le lien la voit,
    // aucun moteur de recherche ne l'indexe ni ne suit ses liens.
    if (path.startsWith("/share/")) reply.header("x-robots-tag", "noindex, nofollow");
    return sendWebIndex ? sendWebIndex(reply) : reply.sendFile("index.html");
  });
}
