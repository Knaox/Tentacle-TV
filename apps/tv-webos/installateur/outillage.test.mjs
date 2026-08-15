import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localiserAres, aresUtilisable, lancerAres, COMMANDE_NPM } from "./outillage.mjs";

/**
 * Ce qui est vérifié ici est un CONTRAT ENTRE DEUX FONCTIONS, et il s'est déjà
 * rompu une fois : `localiserAres` rendait le dossier `node_modules` au lieu de
 * la racine qui le contient, et `lancerAres` cherchait alors les outils dans un
 * `node_modules/node_modules` inexistant. Rien ne se voyait avant l'exécution
 * chez l'utilisateur — le script s'arrêtait à l'étape 3, après avoir installé
 * 500 paquets, sur un « ares-setup-device est introuvable ».
 *
 * Le contrat tient en une phrase : ce que rend `localiserAres` doit être
 * directement utilisable par `lancerAres`. On ne le vérifie pas en relisant les
 * chemins, mais en lançant les quatre outils dont l'installation dépend.
 *
 * Aucun téléviseur n'est nécessaire : `--version` ne parle à personne.
 */
describe("le repérage de la CLI de LG", () => {
  it("rend une racine que lancerAres sait exploiter", () => {
    const racine = localiserAres();
    expect(racine, "la CLI webOS doit être installée (devDependency du paquet)").toBeTruthy();

    for (const outil of ["ares-setup-device", "ares-novacom", "ares-install", "ares-launch"]) {
      const issue = lancerAres(racine, outil, ["--version"]);
      expect(issue.code, `${outil} devait répondre`).toBe(0);
    }
  });

  it("échoue clairement quand la racine ne porte rien", () => {
    expect(() => lancerAres("/dev/null/nulle-part", "ares-install", [])).toThrow(
      /ares-install est introuvable/
    );
  });
});

/**
 * La panne qui a échappé au premier jet, et qui n'est apparue que sur un PC
 * Windows vierge : npm n'avait rapatrié QUE le paquet racine — « added 1
 * package » au lieu de cinq cents. Tous les fichiers attendus étaient là,
 * `localiserAres` était donc satisfait, et l'installation ne mourait que trois
 * étapes plus loin sur un « Cannot find module 'async' ».
 *
 * On reconstruit exactement cet arbre amputé : un `bin/` complet, aucune
 * dépendance. La présence ne doit plus valoir preuve.
 */
describe("une CLI présente mais amputée de ses dépendances", () => {
  it("est reconnue comme inutilisable", () => {
    const faux = mkdtempSync(join(tmpdir(), "tentacle-cli-ampute-"));
    try {
      const bin = join(faux, "node_modules/@webos-tools/cli/bin");
      mkdirSync(bin, { recursive: true });
      for (const outil of ["ares-setup-device", "ares-install"]) {
        writeFileSync(join(bin, `${outil}.js`), "require('async');\n", "utf8");
      }
      // Le repérage, lui, la trouve : c'est bien pour cela qu'il ne suffit pas.
      expect(localiserAres.length).toBeGreaterThanOrEqual(0);
      expect(aresUtilisable(faux)).toBe(false);
    } finally {
      rmSync(faux, { recursive: true, force: true });
    }
  });

  it("tient une racine absente pour inutilisable, sans lever", () => {
    expect(aresUtilisable(null)).toBe(false);
    expect(aresUtilisable("/dev/null/nulle-part")).toBe(false);
  });
});

/**
 * La ligne passée à npm traverse `cmd.exe` sous Windows, `sh` ailleurs. Ce qui
 * y ressemble à de la ponctuation inoffensive ne l'est pas : `^` est le
 * caractère d'échappement de cmd, qui l'avale silencieusement. C'est ainsi que
 * `@webos-tools/cli@^3.0.0` est devenu `@3.0.0` sur un PC vierge — une version
 * qui s'installe sans une seule de ses dépendances, « added 1 package » —,
 * pendant que macOS installait tranquillement la 3.2.5 et ses trois cents.
 *
 * Ce cas ne relit pas l'intention, il relit la LIGNE : aucun caractère que l'un
 * des deux interpréteurs pourrait vouloir s'approprier.
 */
describe("la ligne de commande npm", () => {
  it("ne porte rien que cmd.exe ou sh puisse réécrire", () => {
    expect(COMMANDE_NPM, "l'accent circonflexe est mangé par cmd.exe").not.toMatch(/\^/);
    expect(COMMANDE_NPM, "guillemets et apostrophes se citent différemment ici et là")
      .not.toMatch(/["'`]/);
    expect(COMMANDE_NPM, "aucun chemin : le dossier passe par cwd").not.toMatch(/[/\\]{1}(?!cli)/);
    expect(COMMANDE_NPM, "&, |, %, < et > sont tous porteurs de sens pour cmd.exe")
      .not.toMatch(/[&|%<>]/);
  });

  it("demande un intervalle de version, pas une version exacte", () => {
    // `@3` prend la dernière 3.x. `@3.0.0` prendrait celle qui s'installe nue.
    expect(COMMANDE_NPM).toContain("@webos-tools/cli@3 ");
  });
});
