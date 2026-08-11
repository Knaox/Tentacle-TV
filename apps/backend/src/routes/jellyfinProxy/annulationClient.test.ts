import { describe, it, expect } from "vitest";
import { EventEmitter } from "events";
import type { FastifyReply, FastifyRequest } from "fastify";
import { signalDeRequete } from "./annulationClient";
import { raisonCoupure } from "./journalFlux";

/** Le strict nécessaire : un message entrant qui émet, une réponse qui dit si
 *  elle a fini. Aucun serveur à monter pour éprouver cette logique-là. */
function fauxEchange(writableEnded = false) {
  const entrant = new EventEmitter();
  const request = { raw: entrant } as unknown as FastifyRequest;
  const reply = { raw: { writableEnded } } as unknown as FastifyReply;
  return { entrant, request, reply };
}

const attendreTic = () => new Promise((r) => setTimeout(r, 0));

describe("signalDeRequete", () => {
  it("n'est pas armé tant que rien ne s'est produit", () => {
    const { request, reply } = fauxEchange();
    expect(signalDeRequete(request, reply, 60_000).aborted).toBe(false);
  });

  it("coupe quand le client part avant la fin de la réponse", async () => {
    const { entrant, request, reply } = fauxEchange(false);
    const signal = signalDeRequete(request, reply, 60_000);
    entrant.emit("close");
    await attendreTic();
    expect(signal.aborted).toBe(true);
    expect(raisonCoupure(signal.reason)).toBe("annule");
  });

  it("NE coupe PAS quand la réponse était déjà terminée", async () => {
    const { entrant, request, reply } = fauxEchange(true);
    const signal = signalDeRequete(request, reply, 60_000);
    entrant.emit("close");
    await attendreTic();
    expect(signal.aborted).toBe(false);
  });

  // Timers RÉELS : `AbortSignal.timeout` s'appuie sur le minuteur interne de
  // Node, que les faux timers de vitest ne pilotent pas.
  it("coupe au délai, avec une raison distincte du départ du client", async () => {
    const { request, reply } = fauxEchange();
    const signal = signalDeRequete(request, reply, 10);
    await new Promise((r) => setTimeout(r, 40));
    expect(signal.aborted).toBe(true);
    expect(raisonCoupure(signal.reason)).toBe("delai-absolu");
  });

  it("ne pose son écouteur que sur le message de CETTE requête", () => {
    const { entrant, request, reply } = fauxEchange();
    signalDeRequete(request, reply, 60_000);
    expect(entrant.listenerCount("close")).toBe(1);
  });

  it("compose les deux sources sans AbortSignal.any, quand Node ne l'offre pas", async () => {
    const original = AbortSignal.any;
    // @ts-expect-error — on éprouve le repli sur un Node antérieur à 20.3
    delete AbortSignal.any;
    try {
      const { entrant, request, reply } = fauxEchange(false);
      const signal = signalDeRequete(request, reply, 60_000);
      expect(signal.aborted).toBe(false);
      entrant.emit("close");
      await attendreTic();
      expect(signal.aborted).toBe(true);
      expect(raisonCoupure(signal.reason)).toBe("annule");
    } finally {
      AbortSignal.any = original;
    }
  });
});
