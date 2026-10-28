import { describe, expect, it } from "vitest";
import {
  TRACK_SWIPE_REVEAL,
  claimsTrackSwipe,
  decideTrackSwipe,
  trackSwipeArmed,
  trackSwipeCommit,
  trackSwipeOffset,
} from "./trackSwipe";

const W = 390; // un iPhone de 6,1 pouces
const COMMIT = trackSwipeCommit(W);

describe("balayage d'une rangée de titre — le seuil long", () => {
  it("la moitié de la rangée, bornée : jamais collé au bouton, jamais au bord", () => {
    expect(COMMIT).toBe(195);
    expect(trackSwipeCommit(320)).toBe(TRACK_SWIPE_REVEAL + 72);
    expect(trackSwipeCommit(1024)).toBe(260);
  });
});

describe("balayage — qui prend le geste", () => {
  it("un défilement vertical ou un glissement en biais n'est jamais pris", () => {
    expect(claimsTrackSwipe(20, 30, false)).toBe(false);
    expect(claimsTrackSwipe(20, 11, false)).toBe(false);
    expect(claimsTrackSwipe(8, 0, false)).toBe(false);
  });

  it("franchement vers la droite : pris ; vers la gauche, seulement pour refermer une rangée ouverte", () => {
    expect(claimsTrackSwipe(30, 4, false)).toBe(true);
    expect(claimsTrackSwipe(-30, 4, false)).toBe(false);
    expect(claimsTrackSwipe(-30, 4, true)).toBe(true);
  });
});

describe("balayage — sous le doigt", () => {
  it("ne part jamais vers la gauche ; une rangée ouverte part du bouton découvert", () => {
    expect(trackSwipeOffset(-40, false, W)).toBe(0);
    expect(trackSwipeOffset(-40, true, W)).toBe(TRACK_SWIPE_REVEAL - 40);
    expect(trackSwipeOffset(50, false, W)).toBe(50);
  });

  it("freiné au-delà du seuil long, sans recul", () => {
    const past = trackSwipeOffset(COMMIT + 100, false, W);
    expect(past).toBeGreaterThan(COMMIT);
    expect(past).toBeLessThan(COMMIT + 100);
    expect(trackSwipeArmed(past, W)).toBe(true);
    expect(trackSwipeArmed(COMMIT - 1, W)).toBe(false);
  });
});

describe("balayage — au lâcher", () => {
  it("long (au-delà du seuil) : ajouté à la file, quelle que soit la vitesse", () => {
    expect(decideTrackSwipe({ offset: COMMIT, vx: 0, width: W })).toBe("enqueue");
    expect(decideTrackSwipe({ offset: COMMIT + 40, vx: -2, width: W })).toBe("enqueue");
  });

  it("court : « Lire ensuite » reste découvert, à toucher", () => {
    expect(decideTrackSwipe({ offset: TRACK_SWIPE_REVEAL / 2, vx: 0, width: W })).toBe("reveal");
    expect(decideTrackSwipe({ offset: 120, vx: 0, width: W })).toBe("reveal");
  });

  it("un coup bref vers la droite ouvre ; trop peu, ou un retour vers la gauche, referme", () => {
    expect(decideTrackSwipe({ offset: 20, vx: 0.8, width: W })).toBe("reveal");
    expect(decideTrackSwipe({ offset: 20, vx: 0, width: W })).toBe("close");
    expect(decideTrackSwipe({ offset: 90, vx: -0.8, width: W })).toBe("close");
  });

  it("une rangée ouverte qu'on balaie plus loin ajoute à la file", () => {
    const offset = trackSwipeOffset(COMMIT - TRACK_SWIPE_REVEAL + 5, true, W);
    expect(decideTrackSwipe({ offset, vx: 0, width: W })).toBe("enqueue");
  });
});
