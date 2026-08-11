import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Ce qui arrête une requête vers Jellyfin : le délai, ou le départ du client.
 *
 * # Pourquoi le départ du client compte
 *
 * Le proxy n'écoutait que le délai. Quand le téléviseur saute de quarante
 * minutes en avant, sa pile média abandonne les segments qu'elle avait
 * demandés — mais côté serveur ces requêtes restaient EN VOL jusqu'à leur
 * terme, ou jusqu'aux deux minutes du délai. Chacune retenait une des
 * cinquante connexions du répartiteur, et faisait travailler Jellyfin pour un
 * segment que plus personne n'attendait. Deux sauts d'affilée suffisaient à
 * remplir le pool ; les segments réellement utiles se mettaient alors en file,
 * avec leur propre délai déjà armé.
 *
 * On relaie donc la déconnexion : le `close` du message entrant coupe la
 * requête amont, libère la connexion, et rend son souffle à ffmpeg.
 *
 * # Pourquoi il n'y a rien à libérer
 *
 * L'écouteur est posé sur `request.raw`, un `IncomingMessage` créé POUR CETTE
 * REQUÊTE — et non sur la socket, qu'une connexion persistante ferait servir à
 * des centaines de requêtes. Il disparaît avec elle : aucun désabonnement à
 * orchestrer, aucune accumulation possible.
 */
export function signalDeRequete(
  request: FastifyRequest,
  reply: FastifyReply,
  delaiMs: number,
): AbortSignal {
  const controleur = new AbortController();

  request.raw.on("close", () => {
    // Une réponse menée à son terme ferme elle aussi le message entrant. Ne
    // couper QUE ce qui est inachevé : annuler à la fin normale ferait échouer
    // des requêtes parfaitement servies.
    if (reply.raw.writableEnded) return;
    controleur.abort(new DOMException("client parti", "AbortError"));
  });

  return combiner(AbortSignal.timeout(delaiMs), controleur.signal);
}

/**
 * `AbortSignal.any` n'existe que depuis Node 20.3 et le dépôt n'exige que
 * Node 20. Le repli tient en quelques lignes et propage la RAISON, seule chose
 * qui permette ensuite de distinguer un délai d'un départ (cf. `raisonCoupure`).
 */
function combiner(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any([a, b]);

  const relais = new AbortController();
  if (a.aborted) relais.abort(a.reason);
  else if (b.aborted) relais.abort(b.reason);
  else {
    a.addEventListener("abort", () => relais.abort(a.reason), { once: true });
    b.addEventListener("abort", () => relais.abort(b.reason), { once: true });
  }
  return relais.signal;
}
