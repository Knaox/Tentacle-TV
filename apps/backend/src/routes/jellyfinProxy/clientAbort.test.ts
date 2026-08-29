import { describe, it, expect } from "vitest";
import { EventEmitter } from "events";
import type { FastifyReply, FastifyRequest } from "fastify";
import { requestSignal } from "./clientAbort";
import { cutoffReason } from "./streamLog";

/** Le strict nécessaire : un message entrant qui émet, une réponse qui dit si
 *  elle a fini. Aucun serveur à monter pour éprouver cette logique-là. */
function fakeExchange(writableEnded = false) {
  const incoming = new EventEmitter();
  const request = { raw: incoming } as unknown as FastifyRequest;
  const reply = { raw: { writableEnded } } as unknown as FastifyReply;
  return { incoming, request, reply };
}

const waitTick = () => new Promise((r) => setTimeout(r, 0));

describe("requestSignal", () => {
  it("n'est pas armé tant que rien ne s'est produit", () => {
    const { request, reply } = fakeExchange();
    expect(requestSignal(request, reply, 60_000).aborted).toBe(false);
  });

  it("coupe quand le client part avant la fin de la réponse", async () => {
    const { incoming, request, reply } = fakeExchange(false);
    const signal = requestSignal(request, reply, 60_000);
    incoming.emit("close");
    await waitTick();
    expect(signal.aborted).toBe(true);
    expect(cutoffReason(signal.reason)).toBe("annule");
  });

  it("NE coupe PAS quand la réponse était déjà terminée", async () => {
    const { incoming, request, reply } = fakeExchange(true);
    const signal = requestSignal(request, reply, 60_000);
    incoming.emit("close");
    await waitTick();
    expect(signal.aborted).toBe(false);
  });

  // Timers RÉELS : `AbortSignal.timeout` s'appuie sur le minuteur interne de
  // Node, que les faux timers de vitest ne pilotent pas.
  it("coupe au délai, avec une raison distincte du départ du client", async () => {
    const { request, reply } = fakeExchange();
    const signal = requestSignal(request, reply, 10);
    await new Promise((r) => setTimeout(r, 40));
    expect(signal.aborted).toBe(true);
    expect(cutoffReason(signal.reason)).toBe("delai-absolu");
  });

  it("ne pose son écouteur que sur le message de CETTE requête", () => {
    const { incoming, request, reply } = fakeExchange();
    requestSignal(request, reply, 60_000);
    expect(incoming.listenerCount("close")).toBe(1);
  });

  it("compose les deux sources sans AbortSignal.any, quand Node ne l'offre pas", async () => {
    const original = AbortSignal.any;
    // @ts-expect-error — on éprouve le repli sur un Node antérieur à 20.3
    delete AbortSignal.any;
    try {
      const { incoming, request, reply } = fakeExchange(false);
      const signal = requestSignal(request, reply, 60_000);
      expect(signal.aborted).toBe(false);
      incoming.emit("close");
      await waitTick();
      expect(signal.aborted).toBe(true);
      expect(cutoffReason(signal.reason)).toBe("annule");
    } finally {
      AbortSignal.any = original;
    }
  });
});
