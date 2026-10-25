import { describe, expect, it } from "vitest";
import { PAGE_RESUME_MAX_AGE_MS, isOctavePath, resumePath, resumeScroll, type SavedOctavePage } from "./pageResume";

/** Octave — la page où l'on était : rouverte telle quelle, pour la même identité seulement. */

const BASE = "/octave";
const OWNER = "|user-1";
const NOW = 2_000_000_000_000;
const saved = (over: Partial<SavedOctavePage> = {}): SavedOctavePage => ({ owner: OWNER, path: "/octave/album/a1", scrollTop: 480, savedAt: NOW - 60_000, ...over });

describe("la page d'arrivée", () => {
  it("la page gardée de cette identité, recherche comprise", () => {
    expect(resumePath(saved(), OWNER, NOW, BASE)).toBe("/octave/album/a1");
    expect(resumePath(saved({ path: "/octave/search?q=piano" }), OWNER, NOW, BASE)).toBe("/octave/search?q=piano");
  });

  it("l'accueil d'Octave : rien de gardé, une autre identité, trop ancien, daté du futur, hors d'Octave", () => {
    expect(resumePath(null, OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved(), "|user-2", NOW, BASE)).toBe(BASE);
    expect(resumePath(saved(), null, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved({ savedAt: NOW - PAGE_RESUME_MAX_AGE_MS - 1 }), OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved({ savedAt: NOW + 3_600_000 }), OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved({ path: "/settings" }), OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved({ path: "/octaveevil" }), OWNER, NOW, BASE)).toBe(BASE);
  });

  it("une adresse d'Octave, et elle seule", () => {
    expect(isOctavePath("/octave", BASE)).toBe(true);
    expect(isOctavePath("/octave/library", BASE)).toBe(true);
    expect(isOctavePath("/octave?x=1", BASE)).toBe(true);
    expect(isOctavePath("/watch/1", BASE)).toBe(false);
  });
});

describe("le défilement rejoué", () => {
  it("seulement sur la page gardée elle-même, et s'il y en a un", () => {
    expect(resumeScroll(saved(), OWNER, NOW, BASE, "/octave/album/a1")).toBe(480);
    expect(resumeScroll(saved(), OWNER, NOW, BASE, "/octave")).toBeNull();
    expect(resumeScroll(saved({ scrollTop: 0 }), OWNER, NOW, BASE, "/octave/album/a1")).toBeNull();
    expect(resumeScroll(saved(), "|user-2", NOW, BASE, "/octave/album/a1")).toBeNull();
  });
});
