import { describe, expect, it } from "vitest";
import { localiserAres, lancerAres } from "./outillage.mjs";

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
