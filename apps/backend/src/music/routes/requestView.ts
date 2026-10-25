/** Octave — le compte d'une requête musique, et sa vue (droits, cœur). */

import type { FastifyRequest } from "fastify";
import type { JellyfinUser } from "../../middleware/auth";
import { userView, type UserView } from "../view/viewContext";

export function userOf(request: FastifyRequest): JellyfinUser {
  return (request as unknown as { user: JellyfinUser }).user;
}

export function viewOf(request: FastifyRequest): Promise<UserView> {
  return userView(userOf(request).userId);
}
