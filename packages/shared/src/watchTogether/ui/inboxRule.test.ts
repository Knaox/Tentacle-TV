import { describe, expect, it } from "vitest";
import { isPlayerPath, shouldAutoOpenInbox } from "./inboxRule";

describe("shouldAutoOpenInbox", () => {
  const base = { pathname: "/", startupQuiet: true, inviteIds: ["i1"], shownIds: new Set<string>() };

  it("s'ouvre à l'accueil pour une invitation jamais présentée", () => {
    expect(shouldAutoOpenInbox(base)).toBe(true);
  });
  it("jamais ailleurs qu'à l'accueil, ni avant la fin du démarrage", () => {
    expect(shouldAutoOpenInbox({ ...base, pathname: "/watch/abc" })).toBe(false);
    expect(shouldAutoOpenInbox({ ...base, pathname: "/media/abc" })).toBe(false);
    expect(shouldAutoOpenInbox({ ...base, startupQuiet: false })).toBe(false);
  });
  it("une seule fois par invitation", () => {
    expect(shouldAutoOpenInbox({ ...base, shownIds: new Set(["i1"]) })).toBe(false);
    expect(shouldAutoOpenInbox({ ...base, inviteIds: ["i1", "i2"], shownIds: new Set(["i1"]) })).toBe(true);
  });
});

describe("isPlayerPath", () => {
  it("reconnaît le lecteur", () => {
    expect(isPlayerPath("/watch/42")).toBe(true);
    expect(isPlayerPath("/media/42")).toBe(false);
  });
});
