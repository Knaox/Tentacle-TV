import { describe, expect, it, vi } from "vitest";
import { extensionRoute, notificationHasDestination, resolveNotificationDestination } from "./notificationDestination";
import { groupNotificationsByDay } from "./notificationGroups";

const vigie = [{ pluginId: "seer", navItems: [{ path: "/discover", platforms: ["web", "desktop", "mobile"] }] }];
const requests = { kind: "extension" as const, pluginId: "seer", path: "/discover", params: { tab: "requests", find: "La Chasse", focus: "r42" } };
const base = { type: "request_status", refId: "r42" };

describe("destination d'une notification", () => {
  it("une page d'extension s'ouvre avec ses paramètres, sur le web comme sur le mobile", () => {
    expect(extensionRoute(requests, "web", vigie)).toBe("/discover?tab=requests&find=La+Chasse&focus=r42");
    const mobile = extensionRoute(requests, "mobile", vigie)!;
    const url = new URL(mobile, "tentacle://app");
    expect(url.pathname).toBe("/plugin/seer");
    expect(url.searchParams.get("path")).toBe("/discover");
    expect(url.searchParams.get("query")).toBe("?tab=requests&find=La+Chasse&focus=r42");
  });

  it("une extension coupée ou une page retirée : la route d'avant, tirée du type", async () => {
    const lookup = vi.fn();
    expect(extensionRoute(requests, "web", [])).toBeNull();
    expect(await resolveNotificationDestination({ ...base, target: requests }, "web", [], lookup)).toBeNull();
    const ticket = { type: "ticket_reply", refId: "t1", target: requests };
    expect(await resolveNotificationDestination(ticket, "web", [], lookup)).toBe("/support?ticketId=t1");
  });

  it("un titre arrivé ouvre sa fiche ; absent de la bibliothèque, son repli", async () => {
    const target = { kind: "title" as const, mediaType: "movie" as const, tmdbId: 603, fallback: requests };
    const found = vi.fn().mockResolvedValue("abc123");
    expect(await resolveNotificationDestination({ ...base, target }, "web", vigie, found)).toBe("/media/abc123");
    expect(found).toHaveBeenCalledWith("movie", 603);
    const missing = vi.fn().mockResolvedValue(null);
    expect(await resolveNotificationDestination({ ...base, target }, "web", vigie, missing)).toBe(requests.path + "?tab=requests&find=La+Chasse&focus=r42");
    const broken = vi.fn().mockRejectedValue(new Error("réseau"));
    expect(await resolveNotificationDestination({ ...base, target }, "mobile", vigie, broken)).toMatch(/^\/plugin\/seer\?/);
  });

  it("une notification d'avant (sans cible) garde son comportement", async () => {
    const lookup = vi.fn();
    expect(await resolveNotificationDestination(base, "web", vigie, lookup)).toBe("/discover");
    expect(notificationHasDestination({ type: "inconnu", refId: null }, "web", vigie)).toBe(false);
    expect(notificationHasDestination({ type: "inconnu", refId: null, target: { kind: "item", itemId: "x1" } }, "web", vigie)).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("notifications groupées par jour", () => {
  it("aujourd'hui depuis minuit local, plus tôt avant ; jamais un groupe vide", () => {
    const now = new Date(2026, 9, 15, 10, 0);
    const list = [
      { id: "a", createdAt: new Date(2026, 9, 15, 9, 0).toISOString() },
      { id: "b", createdAt: new Date(2026, 9, 14, 23, 59).toISOString() },
    ];
    expect(groupNotificationsByDay(list, now).map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([["today", ["a"]], ["earlier", ["b"]]]);
    expect(groupNotificationsByDay([list[1]], now).map((g) => g.group)).toEqual(["earlier"]);
    expect(groupNotificationsByDay([], now)).toEqual([]);
  });
});
