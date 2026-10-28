import { describe, expect, it } from "vitest";
import type { MusicHomeMix, MusicHomeResponse } from "../../music";
import { octavePaths } from "../mode/octavePaths";
import { findHomeMix } from "./homeMix";

const mix = (id: string) => ({ id, kind: "favorites", artist: null, artistNames: [], tracks: [] }) as MusicHomeMix;
const home = (mixes: MusicHomeMix[]) => ({ forYou: { mixes } }) as unknown as MusicHomeResponse;

describe("findHomeMix", () => {
  it("retrouve le mix dans la réponse de l'accueil", () => {
    expect(findHomeMix(home([mix("favorites"), mix("artist:x")]), "artist:x")?.id).toBe("artist:x");
  });
  it("un mix renouvelé, un accueil pas encore là, un serveur sans « Pour vous » : rien, sans erreur", () => {
    expect(findHomeMix(home([mix("favorites")]), "artist:old")).toBeNull();
    expect(findHomeMix(undefined, "favorites")).toBeNull();
    expect(findHomeMix({ forYou: undefined }, "favorites")).toBeNull();
  });
  it("l'adresse de la page encode l'identifiant (les « : » d'un mix d'artiste)", () => {
    expect(octavePaths.homeMix("artist:a b")).toBe("/octave/home-mix/artist%3Aa%20b");
  });
});
