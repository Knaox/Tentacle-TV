import { describe, expect, it, vi } from "vitest";
import { markPhotoPending, photoTagFor, subscribePendingPhoto } from "./pendingPhoto";

describe("la photo envoyée en attente de relecture", () => {
  it("rien d'envoyé : l'étiquette stockée", () => {
    expect(photoTagFor("u1", "a1")).toBe("a1");
  });

  it("force la nouvelle image tant que l'étiquette stockée reste l'ancienne, pour ce compte seulement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingPhoto(listener);
    markPhotoPending("u1", "a1", 1234);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(photoTagFor("u1", "a1")).toBe("1234");
    expect(photoTagFor("u2", "a1")).toBe("a1");
    // La relecture a fini par rapporter la nouvelle étiquette : elle reprend la main.
    expect(photoTagFor("u1", "b2")).toBe("b2");
    unsubscribe();
  });

  it("un compte sans photo qui en reçoit une : l'image paraît avant la relecture", () => {
    markPhotoPending("u3", null, 99);
    expect(photoTagFor("u3", null)).toBe("99");
  });
});
