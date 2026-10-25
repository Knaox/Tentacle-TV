import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_RESUME_MAX_AGE_MS,
  beginScrollResume,
  isOctavePath,
  pendingScrollFor,
  resetScrollResumeForTests,
  resumePath,
  resumeScroll,
  scrollToSave,
  settleScrollResume,
  type SavedOctavePage,
} from "./pageResume";

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

describe("le rejeu du défilement, d'un montage à l'autre", () => {
  afterEach(() => {
    resetScrollResumeForTests();
    vi.unstubAllGlobals();
  });
  const stub = (page: SavedOctavePage) => vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "tentacle_octave_page" ? JSON.stringify(page) : null) });

  it("double montage (StrictMode) : la cible survit au démontage, et la sauvegarde ne l'écrase jamais par 0", () => {
    stub(saved({ path: "/octave", scrollTop: 500, savedAt: Date.now() - 1_000 }));
    beginScrollResume(OWNER, "/octave", BASE); // 1er montage
    expect(scrollToSave("/octave", 0)).toBe(500); // sauvegarde du montage, contenu pas encore là
    beginScrollResume(OWNER, "/octave", BASE); // démontage puis 2e montage : relu ? non, gardé
    expect(pendingScrollFor("/octave")).toBe(500);
    settleScrollResume(); // rejeu fait
    expect(pendingScrollFor("/octave")).toBeNull();
    expect(scrollToSave("/octave", 497.6)).toBe(498);
  });

  it("une autre page n'hérite jamais de la cible ; rien de gardé, rien à rejouer", () => {
    stub(saved({ path: "/octave", scrollTop: 500, savedAt: Date.now() - 1_000 }));
    beginScrollResume(OWNER, "/octave", BASE);
    expect(pendingScrollFor("/octave/library")).toBeNull();
    expect(scrollToSave("/octave/library", 12)).toBe(12);
    resetScrollResumeForTests();
    vi.stubGlobal("localStorage", { getItem: () => null });
    beginScrollResume(OWNER, "/octave", BASE);
    expect(pendingScrollFor("/octave")).toBeNull();
  });
});
