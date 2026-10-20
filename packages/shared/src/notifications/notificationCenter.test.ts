import { describe, expect, it } from "vitest";
import { centerShouldFillUnread, centerShowsEmpty, centerUnreadCount } from "./notificationCenter";

const unread = { read: false };
const read = { read: true };

describe("centerUnreadCount", () => {
  it("le compteur du serveur, jamais moins que les non lues à l'écran", () => {
    expect(centerUnreadCount(12, [unread, read])).toBe(12);
    expect(centerUnreadCount(0, [unread, unread, read])).toBe(2);
    expect(centerUnreadCount(undefined, [unread])).toBe(1);
    expect(centerUnreadCount(undefined, [])).toBe(0);
  });
});

describe("centerShouldFillUnread", () => {
  const base = { filter: "unread" as const, serverCount: 5, loaded: [unread, read], hasMore: true, loading: false };
  it("« Non lues » charge la suite tant qu'il en manque", () => {
    expect(centerShouldFillUnread(base)).toBe(true);
  });
  it("jamais sous « Tout », ni sans page de plus, ni pendant un chargement, ni quand tout est là", () => {
    expect(centerShouldFillUnread({ ...base, filter: "all" })).toBe(false);
    expect(centerShouldFillUnread({ ...base, hasMore: false })).toBe(false);
    expect(centerShouldFillUnread({ ...base, loading: true })).toBe(false);
    expect(centerShouldFillUnread({ ...base, serverCount: 1 })).toBe(false);
    expect(centerShouldFillUnread({ ...base, serverCount: undefined })).toBe(false);
  });
});

describe("centerShowsEmpty", () => {
  it("vide seulement une fois lue et sans page en route", () => {
    expect(centerShowsEmpty({ visibleCount: 0, loaded: true, filling: false })).toBe(true);
    expect(centerShowsEmpty({ visibleCount: 0, loaded: true, filling: true })).toBe(false);
    expect(centerShowsEmpty({ visibleCount: 0, loaded: false, filling: false })).toBe(false);
    expect(centerShowsEmpty({ visibleCount: 2, loaded: true, filling: false })).toBe(false);
  });
});
