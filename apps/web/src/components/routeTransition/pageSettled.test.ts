import { describe, expect, it } from "vitest";
import { PAGE_HOLD_DATA_MS, PAGE_HOLD_IMAGES_MS, QUIET_FRAMES, advanceSettle, initialSettleState, type SettleState } from "./pageSettled";

/** Joue des images à 16 ms d'écart ; `sample(i)` dit ce que la page a encore en attente. */
function play(frames: number, sample: (index: number) => { pendingQueries: number; pendingImages: number }, from = initialSettleState(0)) {
  let state: SettleState = from;
  let now = state.mountedAt;
  for (let index = 0; index < frames && !state.settled; index += 1) {
    now += 16;
    state = advanceSettle(state, { now, ...sample(index) });
  }
  return { state, now };
}

describe("une page est-elle prête à se montrer ?", () => {
  it("rien à attendre : prête après les images de silence, pas avant", () => {
    const { state, now } = play(10, () => ({ pendingQueries: 0, pendingImages: 0 }));
    expect(state.settled).toBe(true);
    expect(now).toBe(16 * QUIET_FRAMES);
  });

  it("attend ses requêtes en premier chargement, puis ses images à l'écran", () => {
    // 6 images de requête, puis 4 images d'images qui chargent.
    const { state, now } = play(40, (index) => ({ pendingQueries: index < 6 ? 1 : 0, pendingImages: index < 12 ? 3 : 0 }));
    expect(state.settled).toBe(true);
    expect(now).toBe(16 * 13);
  });

  it("une requête qui en amène une autre remet le silence à zéro", () => {
    // Une image de silence entre deux requêtes : pas encore les données complètes.
    const { state } = play(4, (index) => ({ pendingQueries: index === 1 ? 0 : 1, pendingImages: 0 }));
    expect(state.dataAt).toBeNull();
    expect(state.settled).toBe(false);
  });

  it("un serveur lent ne retient pas la page au-delà du plafond des données", () => {
    const { state, now } = play(200, () => ({ pendingQueries: 2, pendingImages: 0 }));
    expect(state.settled).toBe(true);
    expect(now).toBeGreaterThanOrEqual(PAGE_HOLD_DATA_MS);
    expect(now).toBeLessThan(PAGE_HOLD_DATA_MS + 32);
  });

  it("des images lentes ne la retiennent pas au-delà de leur plafond, compté depuis les données", () => {
    const { state, now } = play(200, () => ({ pendingQueries: 0, pendingImages: 5 }));
    expect(state.settled).toBe(true);
    const dataAt = 16 * QUIET_FRAMES;
    expect(now).toBeGreaterThanOrEqual(dataAt + PAGE_HOLD_IMAGES_MS);
    expect(now).toBeLessThan(dataAt + PAGE_HOLD_IMAGES_MS + 32);
  });

  it("une page prête le reste, quoi qu'il arrive ensuite", () => {
    const { state } = play(10, () => ({ pendingQueries: 0, pendingImages: 0 }));
    const later = advanceSettle(state, { now: 5000, pendingQueries: 4, pendingImages: 9 });
    expect(later).toBe(state);
  });
});
