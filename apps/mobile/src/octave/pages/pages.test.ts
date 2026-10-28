import { afterEach, describe, expect, it, vi } from "vitest";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { closeTrackSheet, openTrackSheet, readTrackSheet } from "./actions/trackSheetStore";
import { NOTICE_MS, dismissNotice, readNotice, showNotice } from "./env/notices";
import { octaveOwnerOf } from "./env/owner";
import { quickPicksShown } from "./home/quickPicksRule";

describe("pages d'Octave (mobile) — règles pures", () => {
  afterEach(() => {
    dismissNotice();
    closeTrackSheet();
    vi.useRealTimers();
  });

  it("le propriétaire de la mémoire : serveur + compte, personne sans session ni identifiant", () => {
    expect(octaveOwnerOf("https://tv.example", JSON.stringify({ Id: "u1", Name: "Damien" }))).toBe("https://tv.example|u1");
    expect(octaveOwnerOf(null, JSON.stringify({ Id: "u1" }))).toBeNull();
    expect(octaveOwnerOf("https://tv.example", null)).toBeNull();
    expect(octaveOwnerOf("https://tv.example", "{pas du json")).toBeNull();
    expect(octaveOwnerOf("https://tv.example", JSON.stringify({ Id: "" }))).toBeNull();
  });

  it("« Écoutés récemment » : deux rangées pleines au plus, jamais une tuile seule", () => {
    expect(quickPicksShown(10, 2)).toBe(4);
    expect(quickPicksShown(5, 3)).toBe(3);
    expect(quickPicksShown(7, 3)).toBe(6);
    expect(quickPicksShown(1, 2)).toBe(1);
    expect(quickPicksShown(0, 3)).toBe(0);
  });

  it("un avis remplace le précédent et s'efface seul (plus longtemps s'il porte une action)", () => {
    vi.useFakeTimers();
    showNotice("success", "Ajouté à « Soirée »", { action: { label: "Changer", onPress: () => undefined } });
    vi.advanceTimersByTime(NOTICE_MS + 10);
    expect(readNotice()?.message).toBe("Ajouté à « Soirée »");
    showNotice("error", "L'ajout a échoué.");
    expect(readNotice()?.kind).toBe("error");
    vi.advanceTimersByTime(NOTICE_MS + 10);
    expect(readNotice()).toBeNull();
  });

  it("la feuille d'un titre s'ouvre et se ferme par son magasin", () => {
    const track = libraryTrack("a");
    openTrackSheet({ track, list: [track], contextId: "album:1", hide: { album: true } });
    expect(readTrackSheet()?.contextId).toBe("album:1");
    closeTrackSheet();
    expect(readTrackSheet()).toBeNull();
  });
});
