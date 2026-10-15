/**
 * L'ancienne route de l'analyse audio des passages, FIGÉE : l'analyse est
 * retirée du serveur (plus d'interrupteur, plus d'outil d'empreinte).
 *
 * Elle ne reste que pour les bureaux déjà livrés, dont la page « Services »
 * la lit sans capacité : une réponse « coupée, sans outil » leur fait montrer
 * l'analyse indisponible, interrupteur grisé — aucune erreur, et ce même
 * interrupteur ne peut plus rien écrire (l'écriture, `PUT`, est retirée).
 * Les clients d'aujourd'hui ne l'appellent plus. La forme de la réponse est
 * celle d'avant, champ pour champ : elle ne se retouche pas.
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../middleware/auth";

const RETIRED_AUDIO_ANALYSIS = {
  enabled: false,
  tool: null,
  counters: { jobs: 0, windows: 0, bytes: 0, seconds: 0, verdicts: 0, silent: 0, deferred: 0 },
} as const;

export const adminSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/audio-analysis", async () => RETIRED_AUDIO_ANALYSIS);
};
