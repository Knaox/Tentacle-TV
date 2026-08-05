import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Les harnais de navigation, servis en développement et nulle part ailleurs.
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
const NOM_ATTENDU = /^harnais-[a-z0-9-]+\.(html|js)$/;

export function servirHarnais(dossier: string): Plugin {
  return {
    name: "tentacle-servir-harnais",
    apply: "serve",
    configureServer(serveur) {
      serveur.middlewares.use((requete, reponse, suivant) => {
        const chemin = (requete.url ?? "").split("?")[0];
        const nom = chemin.replace(/^\/tv\//, "");
        if (!NOM_ATTENDU.test(nom)) return suivant();

        const extension = nom.slice(nom.lastIndexOf("."));
        readFile(resolve(dossier, nom))
          .then((contenu) => {
            reponse.setHeader("Content-Type", TYPES[extension]);
            // Un banc d'essai qu'on modifie entre deux rafales : le relire à
            // chaque requête ne coûte rien, et un cache ferait mentir le test.
            reponse.setHeader("Cache-Control", "no-store");
            reponse.end(contenu);
          })
          .catch(() => {
            reponse.statusCode = 404;
            reponse.end(`Harnais introuvable : ${nom}`);
          });
      });
    },
  };
}
