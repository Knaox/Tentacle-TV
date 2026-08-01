/**
 * Télémétrie de lecture postée vers Jellyfin depuis le PROCESSUS PRINCIPAL.
 *
 * # Le problème que ça résout
 *
 * `playbackTransport.ts` appelle Jellyfin EN DIRECT, et c'est délibéré : le
 * proxy `/api/jellyfin` du backend remplace le jeton de l'utilisateur par la
 * clé admin, et sans contexte utilisateur Jellyfin 10.11 ne sait plus à qui
 * attribuer le playstate. Passer par le proxy, c'est perdre la position de
 * reprise — le code de la page le dit noir sur blanc.
 *
 * Or la page vit sous l'origine `tentacle://app`. Aucun Jellyfin n'a de raison
 * de l'autoriser, le préflight échoue, et la couche de télémétrie bascule sur
 * le proxy pour toute la session. Sous Tauri l'origine était
 * `http://tauri.localhost` — une origine HTTP ordinaire, que la configuration
 * CORS de Jellyfin pouvait couvrir.
 *
 * # Pourquoi ici, et pas des en-têtes CORS injectés
 *
 * La solution qu'on trouve partout est d'ajouter `Access-Control-Allow-Origin`
 * par `webRequest.onHeadersReceived`. Elle marche, et elle est dangereuse dans
 * cette application : les greffons tournent sur l'origine voisine
 * `tentacle://plugin` avec un `connect-src` large. Leur ouvrir la lecture des
 * réponses cross-origin dépasse de très loin le besoin.
 *
 * Le processus principal, lui, n'est pas soumis au CORS. On y poste, on rend le
 * statut, et le modèle de sécurité de la page ne bouge pas d'un pouce. C'est
 * déjà le motif des téléchargements (`netFetch.ts`, `transferNet.ts`).
 *
 * # Ce que cette commande NE PEUT PAS faire
 *
 * Elle n'est pas un `fetch` déguisé offert à la page. Le chemin est borné à la
 * liste FERMÉE ci-dessous : trois points de terminaison de session, rien
 * d'autre. Un greffon qui obtiendrait le pont ne pourrait pas s'en servir pour
 * atteindre une machine arbitraire — au pire il posterait une position de
 * lecture sur un serveur Jellyfin.
 */

import { net } from "electron";
import { z } from "zod";
import { CommandRegistry } from "./registry";

/**
 * Points de terminaison admis, liste FERMÉE.
 *
 * ⚠️ Ne pas remplacer par un motif : c'est cette liste, et elle seule, qui
 * empêche la commande de devenir un relais HTTP généraliste.
 */
const CHEMINS = new Set([
  "/Sessions/Playing",
  "/Sessions/Playing/Progress",
  "/Sessions/Playing/Stopped",
]);

/** Au-delà, la source est morte. Même valeur que le récupérateur du snapshot. */
const TIMEOUT_MS = 20_000;

const POST = z.object({
  /** Base du serveur Jellyfin, telle que la page l'a résolue. */
  baseUrl: z.string().url(),
  path: z.string(),
  token: z.string().min(1),
  authHeader: z.string().min(1),
  /** Corps déjà sérialisé — la page l'a construit, on ne le réinterprète pas. */
  body: z.string(),
});

export function registerJellyfinCommands(registry: CommandRegistry): void {
  registry.add("jellyfin_session_post", {
    schema: POST,
    run: async ({ baseUrl, path, token, authHeader, body }) => {
      if (!CHEMINS.has(path)) throw new Error(`chemin de session refuse: ${path}`);

      const abort = new AbortController();
      const minuteur = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        const response = await net.fetch(`${baseUrl}${path}`, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/json",
            "X-Emby-Token": token,
            "X-Emby-Authorization": authHeader,
          },
          signal: abort.signal,
        });
        return { status: response.status };
      } finally {
        clearTimeout(minuteur);
      }
    },
  });
}
