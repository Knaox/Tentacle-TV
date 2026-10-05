import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { challengeRoutes } from "./challengeRoute";
import { CHALLENGE_MAX_READS, CHALLENGE_TTL_MS, issueChallenge, liveChallengeCount, readChallenge, revokeChallenge } from "./challengeStore";

describe("défis du test d'ouverture", () => {
  it("un défi se lit quelques fois, puis disparaît", () => {
    const { id, token } = issueChallenge(1_000);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    for (let i = 0; i < CHALLENGE_MAX_READS; i++) expect(readChallenge(id, 1_000)).toBe(token);
    expect(readChallenge(id, 1_000)).toBeNull();
  });

  it("expire après 60 secondes, et se révoque", () => {
    const a = issueChallenge(1_000);
    expect(readChallenge(a.id, 1_000 + CHALLENGE_TTL_MS)).toBeNull();
    const b = issueChallenge(1_000);
    revokeChallenge(b.id);
    expect(readChallenge(b.id, 1_000)).toBeNull();
  });

  it("la mémoire reste bornée", () => {
    for (let i = 0; i < 50; i++) issueChallenge(5_000);
    expect(liveChallengeCount()).toBeLessThanOrEqual(16);
  });

  it("la route sert le jeton en texte, et 404 sinon — sans cache", async () => {
    const app = Fastify();
    await app.register(challengeRoutes);
    const { id, token } = issueChallenge();
    const ok = await app.inject({ method: "GET", url: `/.well-known/tentacle-check/${id}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe(token);
    expect(ok.headers["cache-control"]).toBe("no-store");
    for (const url of ["/.well-known/tentacle-check/" + "0".repeat(32), "/.well-known/tentacle-check/../../etc"]) {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
    }
    await app.close();
  });
});
