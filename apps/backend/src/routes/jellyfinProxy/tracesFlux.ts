import type { FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "stream";
import { ligneFlux, raisonCoupure, suiviFluxActif } from "./journalFlux";

/**
 * Le câblage des traces de flux sur le proxy.
 *
 * Séparé de `journalFlux.ts`, qui reste pur et testable sans Fastify : ici on
 * ne fait qu'accrocher ces fonctions aux bons événements, et le handler du
 * proxy — déjà à la limite de ce qu'un fichier peut porter — n'en garde que
 * trois appels.
 */

interface Contexte {
  chemin: string;
  /** `performance.now()` au départ de la requête vers Jellyfin. */
  depart: number;
  statut: number;
  /** `content-length` annoncé par Jellyfin, `null` s'il n'en donne pas. */
  attendus: number | null;
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
export function tracerEntetes(request: FastifyRequest, ctx: Contexte): void {
  if (!suiviFluxActif()) return;
  request.log.info(
    ligneFlux({
      chemin: ctx.chemin, methode: request.method, ms: performance.now() - ctx.depart,
      statut: ctx.statut, attendus: ctx.attendus,
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
export function tracerCorps(
  request: FastifyRequest, reply: FastifyReply, flux: Readable, ctx: Contexte,
): void {
  flux.on("error", (e) => {
    request.log.warn(
      ligneFlux({
        chemin: ctx.chemin, methode: request.method, ms: performance.now() - ctx.depart,
        statut: ctx.statut, attendus: ctx.attendus, cause: raisonCoupure(e),
      }),
      "flux coupe",
    );
  });
  reply.raw.on("close", () => {
    // Une fin normale ferme aussi la socket : seul un corps INACHEVÉ compte.
    if (reply.raw.writableEnded) return;
    request.log.warn(
      ligneFlux({
        chemin: ctx.chemin, methode: request.method, ms: performance.now() - ctx.depart,
        statut: ctx.statut, attendus: ctx.attendus, annule: true,
      }),
      "flux abandonne",
    );
  });
}

/**
 * L'échec avant le premier octet. Rend la cause, que l'appelant réutilise pour
 * son message — `undici` enveloppe tout dans « fetch failed », et sans creuser
 * `err.cause` un délai d'en-têtes dépassé s'écrivait comme une connexion
 * refusée.
 */
export function tracerEchec(
  request: FastifyRequest, chemin: string, depart: number, err: unknown, delaiAbsolu: boolean,
): string {
  const cause = raisonCoupure(err);
  const ligne = ligneFlux({ chemin, methode: request.method, ms: performance.now() - depart, cause });
  // Muette jusqu'ici : la branche du délai rendait son 504 sans écrire un mot.
  if (delaiAbsolu) request.log.warn(ligne, "Jellyfin timeout");
  else request.log.error(ligne, "Proxy error");
  return cause;
}
