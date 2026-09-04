import type { FastifyPluginAsync } from "fastify";

/**
 * Compat : `GET /api/theme` sert un état de thème CONSTANT.
 *
 * Le thème de marque serveur (presets saisonniers, surcharge de jetons, CSS
 * personnalisé, page Thème de l'admin) a été retiré : les jetons de design
 * vivent dans le code des clients. La route survit parce que les clients déjà
 * publiés (mobile 1.6.0, TV 1.0.0) la lisent au démarrage et s'en servent pour
 * RÉINITIALISER une surcharge mise en cache — le mobile garde un miroir
 * AsyncStorage des jetons : une réponse en erreur y laisserait une teinte
 * saisonnière pour toujours, un `tokens: {}` la nettoie. Publique et servie
 * avant le setup, comme avant (liste blanche dans index.ts).
 */
const DEFAULT_THEME_STATE = {
  id: "tentacle-active",
  name: "Tentacle Default",
  tokens: {},
  customCss: { source: null, url: null, hash: null, hasContent: false },
} as const;

export const themeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    reply.header("cache-control", "no-store, max-age=0");
    return DEFAULT_THEME_STATE;
  });
};
