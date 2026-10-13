import { describe, expect, it, vi } from "vitest";
import { createTrailerPreviewArbiter } from "./previewArbiter";

/** « Un seul aperçu à la fois » : le plus récent prend la place, le précédent est évincé. */
describe("l'arbitre des aperçus", () => {
  it("le plus récent prend la place et évince le précédent, une fois", () => {
    const arbiter = createTrailerPreviewArbiter();
    const a = {};
    const b = {};
    const preemptA = vi.fn();
    const preemptB = vi.fn();
    arbiter.claim(a, preemptA);
    arbiter.claim(b, preemptB);
    expect(preemptA).toHaveBeenCalledTimes(1);
    expect(preemptB).not.toHaveBeenCalled();
    expect(arbiter.current()).toBe(b);
  });

  it("le même occupant qui redemande garde sa place, sans s'évincer", () => {
    const arbiter = createTrailerPreviewArbiter();
    const a = {};
    const preempt = vi.fn();
    arbiter.claim(a, preempt);
    arbiter.claim(a, preempt);
    expect(preempt).not.toHaveBeenCalled();
    expect(arbiter.current()).toBe(a);
  });

  it("un évincé qui rend la place ne libère pas celle du suivant", () => {
    const arbiter = createTrailerPreviewArbiter();
    const a = {};
    const b = {};
    arbiter.claim(a, () => undefined);
    arbiter.claim(b, () => undefined);
    arbiter.release(a);
    expect(arbiter.current()).toBe(b);
    arbiter.release(b);
    expect(arbiter.current()).toBeNull();
  });
});
