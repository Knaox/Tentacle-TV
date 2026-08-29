import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Les harness de navigation, servis en développement et nulle part ailleurs.
 *
 * Ils vivaient dans `client/public`, qui est le dossier public de Vite : tout
 * ce qu'il contient est recopié tel quel dans `client/dist`, donc servi en
 * production par le backend. Un banc d'essai n'a rien à faire sur un
 * téléviseur d'utilisateur — et sa présence y serait invisible jusqu'au jour
 * où quelqu'un tomberait dessus.
 *
 * Les SONDES, elles, restent publiques et c'est délibéré : `sonde.html` relève
 * les capacités réelles d'un modèle et ses codes de télécommande, et le README
 * documente qu'elle est servie avant même le premier build. C'est un outil de
 * diagnostic sur dalle, pas un banc d'essai.
 *
 * `apply: "serve"` fait le tri à la racine : ce plugin n'existe pas pendant la
 * construction. Rien à retirer de `dist` après coup, donc rien qui puisse être
 * oublié — la garantie tient dans le cycle de vie du plugin, pas dans une
 * règle de nettoyage qu'il faudrait maintenir.
 */

/** Extensions servies, et le type qui va avec. */
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/** Le nom de fichier, et lui seul : pas de `..`, pas de sous-chemin. */
const EXPECTED_NAME = /^harness-[a-z0-9-]+\.(html|js)$/;

export function serveHarness(dossier: string): Plugin {
  return {
    name: "tentacle-servir-harness",
    apply: "serve",
    configureServer(serveur) {
      serveur.middlewares.use((requete, response, suivant) => {
        const path = (requete.url ?? "").split("?")[0];
        const name = path.replace(/^\/tv\//, "");
        if (!EXPECTED_NAME.test(name)) return suivant();

        const extension = name.slice(name.lastIndexOf("."));
        readFile(resolve(dossier, name))
          .then((content) => {
            response.setHeader("Content-Type", TYPES[extension]);
            // Un banc d'essai qu'on modifie entre deux rafales : le relire à
            // chaque requête ne coûte rien, et un cache ferait mentir le test.
            response.setHeader("Cache-Control", "no-store");
            response.end(content);
          })
          .catch(() => {
            response.statusCode = 404;
            response.end(`Harnais introuvable : ${name}`);
          });
      });
    },
  };
}
