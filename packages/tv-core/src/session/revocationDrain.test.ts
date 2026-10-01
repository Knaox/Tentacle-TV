import { describe, expect, it, vi } from "vitest";

import {
  classifyRevocation,
  drainRevocations,
  nextRevocationDelay,
  revocationRetryDelay,
  type SendRevocation,
} from "./revocationDrain";
import { beginUnpair, readUnpairJournal, type SessionStorage } from "./unpairJournal";

function fakeStorage(): SessionStorage & { content: Map<string, string> } {
  const content = new Map<string, string>();
  return {
    content,
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => void content.set(k, v),
    removeItem: (k) => void content.delete(k),
  };
}

function queued(...tokens: string[]): SessionStorage & { content: Map<string, string> } {
  const storage = fakeStorage();
  for (const token of tokens) beginUnpair(storage, { serverUrl: "https://s", token }, 0);
  return storage;
}

describe("le verdict d'une réponse du serveur", () => {
  it("solde une révocation acceptée", () => {
    expect(classifyRevocation(200)).toBe("done");
    expect(classifyRevocation(204)).toBe("done");
  });

  it("solde un jeton qui n'ouvre plus rien", () => {
    // Révoqué entre-temps depuis la liste des appareils, ou d'un autre secret.
    expect(classifyRevocation(401)).toBe("done");
    expect(classifyRevocation(403)).toBe("done");
  });

  it("attend un serveur d'avant la route, sans le croire", () => {
    expect(classifyRevocation(404)).toBe("retry");
    expect(classifyRevocation(405)).toBe("retry");
  });

  it("retente sans réponse, sur une panne ou une limite de débit", () => {
    expect(classifyRevocation(null)).toBe("retry");
    expect(classifyRevocation(500)).toBe("retry");
    expect(classifyRevocation(503)).toBe("retry");
    expect(classifyRevocation(429)).toBe("retry");
  });
});

describe("le recul entre deux tentatives", () => {
  it("part vite puis s'espace jusqu'à une heure", () => {
    expect(revocationRetryDelay(0)).toBe(5_000);
    expect(revocationRetryDelay(1)).toBe(15_000);
    expect(revocationRetryDelay(5)).toBe(60 * 60_000);
    expect(revocationRetryDelay(40)).toBe(60 * 60_000);
  });
});

describe("vider la file", () => {
  it("envoie chaque jeton dû et solde ceux que le serveur confirme", async () => {
    const storage = queued("a", "b");
    const send = vi.fn<SendRevocation>(async () => 200);
    const next = await drainRevocations(storage, send, () => 10);
    expect(send.mock.calls.map(([r]) => r.token)).toEqual(["a", "b"]);
    expect(readUnpairJournal(storage).revocations).toEqual([]);
    expect(next).toBeNull();
  });

  it("garde un jeton refusé par le réseau et repousse sa tentative", async () => {
    const storage = queued("a");
    const next = await drainRevocations(storage, async () => null, () => 1_000);
    const [pending] = readUnpairJournal(storage).revocations;
    expect(pending.attempts).toBe(1);
    expect(pending.notBefore).toBe(1_000 + 5_000);
    expect(next).toBe(5_000);
  });

  it("traite une exception d'envoi comme une absence de réponse", async () => {
    const storage = queued("a");
    await drainRevocations(storage, async () => { throw new Error("hors ligne"); }, () => 0);
    expect(readUnpairJournal(storage).revocations[0].attempts).toBe(1);
  });

  it("n'envoie pas ce qui n'est pas encore dû", async () => {
    const storage = queued("a");
    await drainRevocations(storage, async () => null, () => 0);
    const send = vi.fn<SendRevocation>(async () => 200);
    const next = await drainRevocations(storage, send, () => 1_000);
    expect(send).not.toHaveBeenCalled();
    expect(next).toBe(4_000);
  });

  it("n'écrase pas un déjumelage survenu pendant l'envoi", async () => {
    const storage = queued("a");
    const send = async () => {
      beginUnpair(storage, { serverUrl: "https://s", token: "b" }, 5);
      return 200;
    };
    await drainRevocations(storage, send, () => 10);
    expect(readUnpairJournal(storage).revocations.map((r) => r.token)).toEqual(["b"]);
  });

  it("rend le délai de la plus proche quand plusieurs attendent", () => {
    const storage = queued("a", "b");
    expect(nextRevocationDelay(storage, 0)).toBe(0);
  });
});
