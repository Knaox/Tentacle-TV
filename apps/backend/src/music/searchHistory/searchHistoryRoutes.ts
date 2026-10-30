/**
 * Octave — les routes de l'HISTORIQUE de la recherche (capacité `music.searchHistory`, contrat
 * `musicSearchHistory.ts`), par COMPTE : celui de la session (un profil de la Famille garde le sien) :
 * - `GET /search-history` : les recherches récentes et les titres récemment recherchés ;
 * - `POST /search-history` : une recherche validée, un titre lancé, ou l'historique d'un appareil à verser ;
 * - `POST /search-history/forget` : une entrée, ou tout.
 * Chaque écriture rend l'historique tel qu'il est gardé.
 */

import type { FastifyInstance } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { parseSearchHistoryAdd, parseSearchHistoryForget } from "../contract/musicSearchHistory";
import { userOf } from "../routes/requestView";
import { addToSearchHistory, forgetSearchHistory, readSearchHistory } from "./searchHistoryStore";

export function musicSearchHistoryRoutes(app: FastifyInstance): void {
  // Sous la version de la capacité, ces routes n'existent pas.
  app.addHook("onRequest", capabilityGate("music.searchHistory"));

  app.get("/search-history", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    return readSearchHistory(userOf(request).userId);
  });

  app.post<{ Body: unknown }>("/search-history", async (request, reply) => {
    const add = parseSearchHistoryAdd(request.body, Date.now());
    if (!add) return reply.status(400).send({ error: "invalid_input" });
    return addToSearchHistory(userOf(request).userId, add);
  });

  app.post<{ Body: unknown }>("/search-history/forget", async (request, reply) => {
    const forget = parseSearchHistoryForget(request.body);
    if (!forget) return reply.status(400).send({ error: "invalid_input" });
    return forgetSearchHistory(userOf(request).userId, forget);
  });
}
