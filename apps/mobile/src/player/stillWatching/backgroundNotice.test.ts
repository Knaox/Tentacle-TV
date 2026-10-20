import { describe, expect, it } from "vitest";
import { stillWatchingNotice } from "./backgroundNotice";

describe("« Vous regardez encore ? » hors de l'écran", () => {
  it("la question et la pause se notifient seulement quand l'app n'est pas au premier plan", () => {
    expect(stillWatchingNotice("asking", "background")).toBe("ask");
    expect(stillWatchingNotice("paused", "background")).toBe("paused");
    expect(stillWatchingNotice("asking", "inactive")).toBe("ask");
    expect(stillWatchingNotice("asking", "active")).toBeNull();
    expect(stillWatchingNotice("none", "background")).toBeNull();
  });
});
