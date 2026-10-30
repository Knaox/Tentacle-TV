import { afterEach, describe, expect, it, vi } from "vitest";
import { savedPageValid } from "@tentacle-tv/shared/octave/mode";
import {
  PAGE_RESUME_MAX_AGE_MS,
  beginScrollResume,
  isOctavePath,
  pendingScrollFor,
  resetScrollResumeForTests,
  resumePath,
  resumeScroll,
  scrollToSave,
  type SavedOctavePage,
} from "./pageResume";

/**
 * Octave — la page où l'on était. Lot « fl » (30/10) : une app rouverte à froid en Octave arrive sur l'ACCUEIL
 * d'Octave, en haut, quelle que soit la page gardée.
 */

const BASE = "/octave";
const OWNER = "|user-1";
const NOW = 2_000_000_000_000;
const saved = (over: Partial<SavedOctavePage> = {}): SavedOctavePage => ({ owner: OWNER, path: "/octave/album/a1", scrollTop: 480, savedAt: NOW - 60_000, ...over });

describe("la page d'arrivée au lancement", () => {
  it("toujours l'accueil d'Octave, même avec une page gardée valide de cette identité", () => {
    expect(resumePath(saved(), OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(saved({ path: "/octave/search?q=piano" }), OWNER, NOW, BASE)).toBe(BASE);
    expect(resumePath(null, OWNER, NOW, BASE)).toBe(BASE);
  });

  it("la page gardée reste jugée par identité, âge et adresse (si la règle revenait)", () => {
    expect(savedPageValid(saved(), OWNER, NOW, BASE)).toBe(true);
    expect(savedPageValid(saved(), "|user-2", NOW, BASE)).toBe(false);
    expect(savedPageValid(saved(), null, NOW, BASE)).toBe(false);
    expect(savedPageValid(saved({ savedAt: NOW - PAGE_RESUME_MAX_AGE_MS - 1 }), OWNER, NOW, BASE)).toBe(false);
    expect(savedPageValid(saved({ savedAt: NOW + 3_600_000 }), OWNER, NOW, BASE)).toBe(false);
    expect(savedPageValid(saved({ path: "/settings" }), OWNER, NOW, BASE)).toBe(false);
    expect(savedPageValid(saved({ path: "/octaveevil" }), OWNER, NOW, BASE)).toBe(false);
  });

  it("une adresse d'Octave, et elle seule", () => {
    expect(isOctavePath("/octave", BASE)).toBe(true);
    expect(isOctavePath("/octave/library", BASE)).toBe(true);
    expect(isOctavePath("/octave?x=1", BASE)).toBe(true);
    expect(isOctavePath("/watch/1", BASE)).toBe(false);
  });
});

describe("aucun défilement rejoué au lancement", () => {
  afterEach(() => {
    resetScrollResumeForTests();
    vi.unstubAllGlobals();
  });

  it("ni sur une page gardée, ni sur l'accueil gardé défilé : l'accueil s'ouvre en haut", () => {
    expect(resumeScroll(saved(), OWNER, NOW, BASE, "/octave/album/a1")).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "tentacle_octave_page" ? JSON.stringify(saved({ path: "/octave", scrollTop: 500, savedAt: Date.now() - 1_000 })) : null),
    });
    beginScrollResume(OWNER, "/octave", BASE);
    expect(pendingScrollFor("/octave")).toBeNull();
    expect(scrollToSave("/octave", 497.6)).toBe(498);
  });
});
