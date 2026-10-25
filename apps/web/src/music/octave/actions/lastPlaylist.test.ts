import { describe, expect, it } from "vitest";
import { quickTarget } from "./lastPlaylist";

/** Le « + » : la dernière playlist utilisée, si elle existe encore et se modifie ; sinon le choix (25/10). */
describe("cible de l'ajout rapide", () => {
  const playlists = [
    { jellyfinId: "a", name: "Soirée", editable: true },
    { jellyfinId: "b", name: "Partagée", editable: false },
  ];
  it("la dernière utilisée", () => expect(quickTarget(playlists, "a")?.name).toBe("Soirée"));
  it("aucune connue, supprimée ou en lecture seule : le choix", () => {
    expect(quickTarget(playlists, null)).toBeNull();
    expect(quickTarget(playlists, "disparue")).toBeNull();
    expect(quickTarget(playlists, "b")).toBeNull();
  });
});
