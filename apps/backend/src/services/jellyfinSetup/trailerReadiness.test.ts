/**
 * Le résumé client des bandes-annonces : franc — il ne dit « mal réglé » que
 * sur une cause nette (TMDB coupé, ou moins d'un titre sur cinq, sur vingt au
 * moins) — et muet (`unknown`) quand il n'y a rien à juger.
 */

import { describe, expect, it } from "vitest";
import type { SetupLibrary } from "../jellyfinCompat/setupContract";
import type { SetupSnapshot } from "./setupSnapshot";
import { summarizeReadiness } from "./trailerReadiness";

const AT = "2026-09-29T12:00:00Z";
const TMDB = { Name: "TMDb", Status: "Active", Id: "b8715ed16c4745289ad3f72deb539cd4" };
const ON: SetupLibrary[] = [{ id: "films", name: "Films", enabled: true }];

function snapshot(patch: Partial<SetupSnapshot> = {}): SetupSnapshot {
  return {
    version: "12.1.0",
    restartPending: false,
    libraries: [{ Name: "Films", CollectionType: "movies", ItemId: "films", LibraryOptions: {} }],
    plugins: [TMDB],
    config: {},
    encoding: {},
    tasks: [],
    missingTmdb: 0,
    trailers: { titles: 100, withTmdb: 80, withTrailer: 60, sampled: false },
    ...patch,
  };
}

describe("résumé client des bandes-annonces", () => {
  it("TMDB actif et bien couvert : prêt, avec la part mesurée", () => {
    expect(summarizeReadiness(snapshot(), ON, AT)).toEqual({ state: "ready", reasons: [], coverage: 0.75, checkedAt: AT });
  });

  it("greffon TMDb coupé, fournisseur retiré : mal réglé, les deux causes dites", () => {
    const off = snapshot({ plugins: [{ ...TMDB, Status: "Disabled" }] });
    expect(summarizeReadiness(off, [{ id: "films", name: "Films", enabled: false }], AT)).toMatchObject({
      state: "misconfigured",
      reasons: ["tmdb-plugin-disabled", "tmdb-fetcher-disabled"],
    });
  });

  it("moins d'un titre sur cinq, sur vingt au moins : peu de bandes-annonces", () => {
    const few = snapshot({ trailers: { titles: 100, withTmdb: 80, withTrailer: 10, sampled: false } });
    expect(summarizeReadiness(few, ON, AT)).toMatchObject({ state: "misconfigured", reasons: ["few-trailers"], coverage: 0.125 });
  });

  it("une petite bibliothèque ne juge pas la couverture", () => {
    const small = snapshot({ trailers: { titles: 5, withTmdb: 4, withTrailer: 0, sampled: false } });
    expect(summarizeReadiness(small, ON, AT)).toMatchObject({ state: "ready", reasons: [], coverage: 0 });
  });

  it("aucun titre connu de TMDB sur une vraie bibliothèque : peu de bandes-annonces", () => {
    const none = snapshot({ trailers: { titles: 50, withTmdb: 0, withTrailer: 0, sampled: false } });
    expect(summarizeReadiness(none, ON, AT)).toMatchObject({ state: "misconfigured", reasons: ["few-trailers"], coverage: 0 });
  });

  it("rien à juger — ni bibliothèque vidéo, ni titre, ni lecture : inconnu, sans cause", () => {
    const unknown = { state: "unknown", reasons: [], coverage: null, checkedAt: AT };
    expect(summarizeReadiness(snapshot({ libraries: [] }), ON, AT)).toEqual(unknown);
    expect(summarizeReadiness(snapshot({ trailers: null }), ON, AT)).toEqual(unknown);
    expect(summarizeReadiness(snapshot({ plugins: null }), ON, AT)).toEqual(unknown);
    expect(summarizeReadiness(snapshot(), null, AT)).toEqual(unknown);
    expect(summarizeReadiness(snapshot({ libraries: [{ Name: "Musique", CollectionType: "music" }] }), ON, AT)).toEqual(unknown);
  });
});
