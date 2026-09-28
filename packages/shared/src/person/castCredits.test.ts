import { describe, expect, it } from "vitest";
import { castCredits, type CastPerson } from "./castCredits";

const p = (Id: string, Type: string, Role?: string): CastPerson => ({ Id, Name: `N-${Id}`, Type, Role, PrimaryImageTag: `t-${Id}` });

describe("castCredits — une carte par personne", () => {
  it("l'équipe réunit les métiers d'une même personne, dans l'ordre du générique", () => {
    const { crew } = castCredits([p("fd", "Writer"), p("fd", "Director"), p("nm", "Producer")]);
    expect(crew.map((c) => [c.id, c.crewRoles, c.linkRole])).toEqual([
      ["fd", ["Director", "Writer"], "Director"],
      ["nm", ["Producer"], "Producer"],
    ]);
  });

  it("borne chaque métier : deux producteurs au plus", () => {
    const { crew } = castCredits([p("a", "Producer"), p("b", "Producer"), p("c", "Producer")]);
    expect(crew.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("la distribution réunit les personnages, GuestStar compris, et se borne", () => {
    const { actors } = castCredits([p("x", "Actor", "Red"), p("y", "GuestStar", "Tommy"), p("x", "Actor", "Narrateur"), p("z", "Actor")], 2);
    expect(actors.map((a) => [a.id, a.character])).toEqual([["x", "Red / Narrateur"], ["y", "Tommy"]]);
  });

  it("les crédits qu'on ne montre pas restent dehors ; rien ne casse sur rien", () => {
    expect(castCredits([p("q", "Lyricist")])).toEqual({ crew: [], actors: [] });
    expect(castCredits(undefined)).toEqual({ crew: [], actors: [] });
  });
});
