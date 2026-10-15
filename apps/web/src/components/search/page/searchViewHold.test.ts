import { describe, expect, it } from "vitest";
import { episodesSettled, type EpisodesQueryState } from "./searchViewHold";

/**
 * Les résultats attendent-ils leurs épisodes ? Oui tant que la requête des
 * épisodes de CETTE recherche n'a pas répondu ; jamais pour un onglet qui
 * n'en montre pas, une requête coupée ou une erreur.
 */
const base: EpisodesQueryState = { wanted: true, isPending: false, isError: false, isPlaceholderData: false, fetchStatus: "idle" };

describe("episodesSettled", () => {
  it("attend une première réponse en cours", () => {
    expect(episodesSettled({ ...base, isPending: true, fetchStatus: "fetching" })).toBe(false);
  });

  it("attend pendant une frappe : la réponse affichée est celle d'avant", () => {
    expect(episodesSettled({ ...base, isPlaceholderData: true, fetchStatus: "fetching" })).toBe(false);
  });

  it("libère dès la réponse de cette requête", () => {
    expect(episodesSettled(base)).toBe(true);
    // Une relecture en fond d'une réponse déjà là n'attend rien.
    expect(episodesSettled({ ...base, fetchStatus: "fetching" })).toBe(true);
  });

  it("n'attend jamais un onglet sans épisodes, une requête coupée ou une erreur", () => {
    expect(episodesSettled({ ...base, wanted: false, isPending: true, fetchStatus: "fetching" })).toBe(true);
    expect(episodesSettled({ ...base, isPending: true, fetchStatus: "idle" })).toBe(true);
    expect(episodesSettled({ ...base, isPlaceholderData: true, fetchStatus: "idle" })).toBe(true);
    expect(episodesSettled({ ...base, isPending: true, isError: true })).toBe(true);
  });
});
