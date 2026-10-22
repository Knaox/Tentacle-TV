/**
 * Une erreur du serveur ne dit rien de l'intérieur : sur une 5xx, ni le
 * message (chemin, requête SQL, adresse de Jellyfin), ni la pile — le journal
 * seul les garde. Une 4xx garde son message, une `ZodError` ses chemins.
 */

import Fastify from "fastify";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "../services/errorHandler";

const SECRET_DETAIL = "SELECT * FROM server_config WHERE key = 'jwt_secret' — /data/tentacle.db";

async function appWithHandler() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.get("/boom", async () => {
    throw new Error(SECRET_DETAIL);
  });
  app.get("/upstream", async () => {
    throw Object.assign(new Error(`connect ECONNREFUSED http://jellyfin:8096 ${SECRET_DETAIL}`), { statusCode: 502 });
  });
  app.get("/refused", async () => {
    throw Object.assign(new Error("Code invalide"), { statusCode: 409 });
  });
  app.post("/validated", async (request) => z.object({ name: z.string().min(1) }).parse(request.body));
  return app;
}

describe("aucune fuite par les erreurs", () => {
  it("une erreur inattendue rend 500 « Internal server error », sans message ni pile", async () => {
    const app = await appWithHandler();
    const res = await app.inject({ url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ message: "Internal server error" });
    expect(res.body).not.toContain("jwt_secret");
    expect(res.body).not.toMatch(/at .*\.ts:\d+/);
  });

  it("une 5xx portée (Jellyfin muet) ne recopie pas son message brut", async () => {
    const app = await appWithHandler();
    const res = await app.inject({ url: "/upstream" });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ message: "Internal server error" });
  });

  it("une 4xx garde son message, voulu pour le client", async () => {
    const app = await appWithHandler();
    const res = await app.inject({ url: "/refused" });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ message: "Code invalide" });
  });

  it("un corps invalide rend 400 « Validation error », sans pile", async () => {
    const app = await appWithHandler();
    const res = await app.inject({ method: "POST", url: "/validated", payload: { name: 42 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Validation error");
    expect(res.body).not.toContain("stack");
    expect(res.body).not.toMatch(/at .*\.(ts|js):\d+/);
  });
});
