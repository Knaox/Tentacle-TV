/**
 * L'espace `adminServices` : les deux langues ont exactement les mêmes clés
 * (une clé oubliée afficherait son nom brut), aucune vide, et la carte
 * « Base de données » a ses mots — SQLite, et MariaDB pour un serveur d'avant.
 */

import { describe, expect, it } from "vitest";
import en from "./locales/en/adminServices";
import fr from "./locales/fr/adminServices";

const DATABASE_CARD = [
  "databaseTitle", "databaseDescription", "databaseEngine", "databaseVersion", "databaseSize", "databasePath",
  "databaseConnected", "databaseWontOpen", "databaseOnNetwork", "databaseErrorTitle", "databaseErrorLogs",
  "databaseNetworkTitle", "databaseNetwork",
  "databaseDescriptionMariaDb", "databaseHost", "databasePort", "databaseName", "databaseUser", "databaseDown", "databaseRestart", "databasePending",
];

describe("vocabulaire de la page « Services »", () => {
  it("le français et l'anglais ont les mêmes clés, aucune vide", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect([...Object.values(fr), ...Object.values(en)].filter((value) => value.trim() === "")).toEqual([]);
  });

  it("la carte « Base de données » a tous ses mots", () => {
    for (const key of DATABASE_CARD) expect(fr, key).toHaveProperty(key);
  });
});
