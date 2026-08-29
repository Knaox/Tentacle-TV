import type { FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "stream";
import { streamLine, cutoffReason, streamTrackingEnabled } from "./streamLog";

/**
 * Le câblage des traces de flux sur le proxy.
 *
 * Séparé de `streamLog.ts`, qui reste pur et testable sans Fastify : ici on
 * ne fait qu'accrocher ces fonctions aux bons événements, et le handler du
 * proxy — déjà à la limite de ce qu'un fichier peut porter — n'en garde que
 * trois appels.
 */

/** L'en-tête `Range` tel que le client l'a posé, s'il l'a posé. */
function requestedRange(request: FastifyRequest): string | null {
  const raw = request.headers.range;
  return typeof raw === "string" ? raw : null;
}

interface TraceContext {
  path: string;
  /** `performance.now()` au départ de la requête vers Jellyfin. */
  start: number;
  status: number;
  /** `content-length` annoncé par Jellyfin, `null` s'il n'en donne pas. */
  expected: number | null;
}

/**
 * Le temps d'ARRIVÉE DES EN-TÊTES, et lui seul, mesure l'attente de ffmpeg :
 * Jellyfin retient la réponse d'un segment tant qu'il ne l'a pas produit. C'est
 * la mesure qui départage une lecture saine d'un saut qui fait redémarrer
 * l'encodage — donc la seule qui dise pourquoi le téléviseur s'est figé.
 *
 * Un film fait plus de mille segments : cette ligne-là ne s'écrit que pour une
 * campagne de mesure (`TENTACLE_JOURNAL_FLUX=1`), jamais en production.
 */
export function traceHeaders(request: FastifyRequest, ctx: TraceContext): void {
  if (!streamTrackingEnabled()) return;
  request.log.info(
    streamLine({
      chemin: ctx.path, methode: request.method, ms: performance.now() - ctx.start,
      statut: ctx.status, attendus: ctx.expected, plage: requestedRange(request),
    }),
    "flux servi",
  );
}

/**
 * Le trou du filet : une fois le flux rendu à Fastify, la requête a RENDU. Une
 * coupure du corps — délai atteint pendant le téléchargement, socket amont
 * perdue — ne passe plus par aucun `catch`, et le client reçoit moins d'octets
 * que le `content-length` qu'on vient de lui annoncer. Sur un téléviseur, une
 * lecture courte devient un `MEDIA_ERR_NETWORK`, et la lecture se fige sans que
 * rien, nulle part, n'en ait gardé trace.
 */
export function traceBody(
  request: FastifyRequest, reply: FastifyReply, stream: Readable, ctx: TraceContext,
): void {
  // Le compteur est pris sur la SOCKET, pas sur le flux amont. Poser un
  // écouteur `data` sur `flux` le basculerait en mode « flowing » avant que
  // Fastify ne le branche sur la réponse, et les premiers morceaux seraient
  // perdus — on mesurerait le transfert en le cassant.
  //
  // `bytesWritten` cumule sur une socket gardée ouverte : on retient sa valeur
  // de départ et on soustrait. Les quelques centaines d'octets d'en-têtes HTTP
  // de cette réponse-ci sont comptés dedans, ce qui est sans portée devant des
  // segments de plusieurs mégaoctets.
  const out = reply.raw.socket;
  const bytesBefore = out?.bytesWritten ?? 0;
  const bodyStart = performance.now();
  const written = () => (out ? out.bytesWritten - bytesBefore : null);

  stream.on("error", (e) => {
    request.log.warn(
      streamLine({
        chemin: ctx.path, methode: request.method, ms: performance.now() - ctx.start,
        statut: ctx.status, attendus: ctx.expected, plage: requestedRange(request),
        octets: written(), msCorps: performance.now() - bodyStart,
        cause: cutoffReason(e),
      }),
      "flux coupe",
    );
  });
  reply.raw.on("close", () => {
    const bytes = written();
    const bodyMs = performance.now() - bodyStart;
    // Une fin normale ferme aussi la socket : seul un corps INACHEVÉ est une
    // anomalie. Mais les deux valent d'être mesurés — c'est en comparant le
    // débit d'un segment servi entier à celui d'un segment lâché qu'on saura si
    // le téléviseur manque de bande passante ou refuse le contenu.
    const entry = {
      chemin: ctx.path, methode: request.method, ms: performance.now() - ctx.start,
      statut: ctx.status, attendus: ctx.expected, plage: requestedRange(request),
      octets: bytes, msCorps: bodyMs,
    };
    if (reply.raw.writableEnded) {
      if (streamTrackingEnabled()) request.log.info(streamLine(entry), "flux termine");
      return;
    }
    request.log.warn(streamLine({ ...entry, annule: true }), "flux abandonne");
  });
}

/**
 * L'échec avant le premier octet. Rend la cause, sur laquelle l'appelant décide
 * quoi répondre — `undici` enveloppe tout dans « fetch failed », et sans creuser
 * `err.cause` un délai d'en-têtes dépassé s'écrivait comme une connexion
 * refusée.
 *
 * Le niveau suit la gravité, et une annulation n'en est pas une : depuis qu'on
 * relaie le départ du client vers Jellyfin, chaque saut du téléviseur en
 * produit une poignée. Les crier en `error` ferait passer le remède pour la
 * panne.
 */
export function traceFailure(
  request: FastifyRequest, path: string, start: number, err: unknown,
): string {
  const cause = cutoffReason(err);
  const line = streamLine({
    chemin: path, methode: request.method, ms: performance.now() - start, cause,
    annule: cause === "annule" || undefined,
  });
  if (cause === "annule") request.log.info(line, "requete abandonnee par le client");
  // Muette jusqu'ici : la branche du délai rendait son 504 sans écrire un mot.
  else if (cause === "delai-absolu") request.log.warn(line, "Jellyfin timeout");
  else request.log.error(line, "Proxy error");
  return cause;
}
