import type { FastifyInstance } from "fastify";

/**
 * Parsers de corps de requête custom (extraits d'index.ts pour le garder
 * sous la limite projet de 300 lignes) :
 * - JSON tolérant les corps vides (DELETE avec Content-Type: application/json)
 * - application/octet-stream brut (corps proxifiés vers Jellyfin)
 * - image/* en texte (upload d'avatar : Jellyfin reçoit le fichier en BASE64)
 */
export function registerBodyParsers(app: FastifyInstance): void {
  // Override default JSON parser to tolerate empty bodies (fixes DELETE with Content-Type: application/json)
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const str = typeof body === "string" ? body : "";
      if (!str.trim()) { done(null, undefined); return; }
      try { done(null, JSON.parse(str)); } catch (err) { done(err as Error, undefined); }
    }
  );

  // Content type parser for raw binary (proxied bodies)
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
  );

  // Images proxied to Jellyfin (avatar upload: POST Users/{id}/Images/Primary
  // envoie le fichier en BASE64 texte avec Content-Type image/*) — sans parser,
  // Fastify répondrait 415 avant même d'atteindre le proxy.
  app.addContentTypeParser(
    /^image\/.*/,
    { parseAs: "string", bodyLimit: 20 * 1024 * 1024 },
    (_req, body, done) => done(null, body)
  );
}
