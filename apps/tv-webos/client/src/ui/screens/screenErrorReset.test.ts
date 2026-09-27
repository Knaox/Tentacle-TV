import { describe, expect, it } from "vitest";
import { followLocation, type ErrorScreenState } from "./screenErrorReset";

const failure = new TypeError("Failed to fetch dynamically imported module: /tv/assets/MediaDetail-x.js");

describe("followLocation — l'écran de reprise suit la navigation", () => {
  it("ne touche à rien tant qu'aucune erreur n'est survenue", () => {
    expect(followLocation({ error: null, errorKey: null }, "a")).toBeNull();
  });

  it("retient l'adresse de l'erreur à sa première passe, sans se refermer", () => {
    // L'erreur est née dans le rendu qui ouvrait « fiche » : c'est l'adresse
    // courante, pas une navigation qu'on aurait faite depuis.
    expect(followLocation({ error: failure, errorKey: null }, "fiche")).toEqual({ errorKey: "fiche" });
  });

  it("reste affiché tant qu'on ne quitte pas l'adresse de l'erreur", () => {
    const state: ErrorScreenState = { error: failure, errorKey: "fiche" };
    expect(followLocation(state, "fiche")).toBeNull();
  });

  it("se referme quand on navigue ailleurs — Retour, rail, lien", () => {
    const state: ErrorScreenState = { error: failure, errorKey: "fiche" };
    expect(followLocation(state, "accueil")).toEqual({ error: null, errorKey: null });
  });
});
