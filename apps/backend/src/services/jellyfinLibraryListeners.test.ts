import { describe, expect, it } from "vitest";
import { notifyLibraryListeners, onLibraryChanged, type LibraryChange } from "./jellyfinLibraryListeners";

describe("abonnés au LibraryChanged de Jellyfin", () => {
  it("reçoivent chaque salve, les copies d'une même salve une seule fois, deux salves rapprochées toutes les deux", () => {
    const seen: LibraryChange[] = [];
    const off = onLibraryChanged((change) => seen.push(change));
    notifyLibraryListeners({ ItemsAdded: ["a1"], ItemsUpdated: [], ItemsRemoved: [] }, 1_000);
    // La copie du deuxième appareil connecté.
    notifyLibraryListeners({ ItemsAdded: ["a1"], ItemsUpdated: [], ItemsRemoved: [] }, 1_050);
    // Une autre salve, 500 ms après : la fenêtre des rangées l'écarterait, pas celle-ci.
    notifyLibraryListeners({ ItemsAdded: ["a2"], ItemsUpdated: ["a1"], ItemsRemoved: ["old", "../x"] }, 1_500);
    off();
    notifyLibraryListeners({ ItemsAdded: ["a3"] }, 9_000);
    expect(seen).toEqual([
      { added: ["a1"], updated: [], removed: [] },
      { added: ["a2"], updated: ["a1"], removed: ["old"] },
    ]);
  });
});
