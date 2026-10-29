import { describe, expect, it } from "vitest";
import { decideNotificationTap, KNOWN_NOTIFICATION_TYPES, notificationNeedsPlugins, type KnownNotificationType } from "./notificationTap";
import { resolveNotificationDestination } from "./notificationDestination";
import { notificationAgo, notificationVisual } from "./notificationVisual";

const VIGIE = {
  pluginId: "seer",
  navItems: [
    { path: "/discover", platforms: ["web", "desktop", "mobile"] },
    { path: "/requests", platforms: ["web", "desktop", "mobile"] },
  ],
};
const noLookup = async () => null;

/**
 * La table COMPLÈTE : chaque type connu, avec sa référence, sur le mobile et
 * sur le web (le bureau sert le build web). Un type ajouté à la liste sans
 * destination fait échouer ce test.
 */
const EXPECTED: Record<KnownNotificationType, { mobile: string; web: string }> = {
  ticket_reply: { mobile: "/support?ticketId=r1", web: "/support?ticketId=r1" },
  ticket_status: { mobile: "/support?ticketId=r1", web: "/support?ticketId=r1" },
  ticket_new: { mobile: "/support?ticketId=r1", web: "/admin/tickets?ticketId=r1" },
  ticket_user_reply: { mobile: "/support?ticketId=r1", web: "/admin/tickets?ticketId=r1" },
  ticket_user_closed: { mobile: "/support?ticketId=r1", web: "/admin/tickets?ticketId=r1" },
  request_status: { mobile: "/extensions?section=seer%3A%2Frequests", web: "/requests" },
  library_added: { mobile: "/media/r1", web: "/media/r1" },
  watchlist_share: { mobile: "/shared-watchlist/r1", web: "/watchlist" },
  music_playlist_shared: { mobile: "/octave/playlist/r1", web: "/octave/playlist/r1" },
  family_invite: { mobile: "/family", web: "/family" },
  family_invite_accepted: { mobile: "/family", web: "/family" },
  family_invite_declined: { mobile: "/family", web: "/family" },
  family_member_left: { mobile: "/family", web: "/family" },
  family_member_removed: { mobile: "/family", web: "/family" },
  family_dissolved: { mobile: "/family", web: "/family" },
};

describe("table des destinations — tous les types connus", () => {
  for (const type of KNOWN_NOTIFICATION_TYPES) {
    it(`${type} mène au bon endroit, sur le mobile comme sur le web`, async () => {
      const n = { type, refId: "r1", target: null };
      expect(await resolveNotificationDestination(n, "mobile", [VIGIE], noLookup)).toBe(EXPECTED[type].mobile);
      expect(await resolveNotificationDestination(n, "web", [VIGIE], noLookup)).toBe(EXPECTED[type].web);
    });
  }

  it("la cible de l'émetteur passe avant le type", async () => {
    const n = { type: "request_status", refId: "r1", target: { kind: "item" as const, itemId: "abc" } };
    expect(await resolveNotificationDestination(n, "mobile", [VIGIE], noLookup)).toBe("/media/abc");
  });

  it("un titre retrouvé ouvre sa fiche ; absent, son repli ; sans repli, le type", async () => {
    const title = { kind: "title" as const, mediaType: "movie" as const, tmdbId: 42 };
    const found = async () => "jf1";
    expect(await resolveNotificationDestination({ type: "request_status", refId: null, target: title }, "mobile", [VIGIE], found)).toBe("/media/jf1");
    const withFallback = { ...title, fallback: { kind: "extension" as const, pluginId: "seer", path: "/requests", params: { id: "7" } } };
    expect(await resolveNotificationDestination({ type: "x", refId: null, target: withFallback }, "mobile", [VIGIE], noLookup))
      .toBe("/plugin/seer?path=%2Frequests&query=%3Fid%3D7");
    expect(await resolveNotificationDestination({ type: "request_status", refId: null, target: title }, "mobile", [VIGIE], noLookup))
      .toBe("/extensions?section=seer%3A%2Frequests");
  });

  it("une recherche de titre qui échoue (réseau) ne bloque pas : le repli", async () => {
    const failing = async () => { throw new Error("offline"); };
    const n = { type: "library_added", refId: "r1", target: { kind: "title" as const, mediaType: "tv" as const, tmdbId: 9 } };
    expect(await resolveNotificationDestination(n, "mobile", [], failing)).toBe("/media/r1");
  });

  it("extension coupée ou page retirée : la route du type, sinon rien", async () => {
    const target = { kind: "extension" as const, pluginId: "gone", path: "/x" };
    expect(await resolveNotificationDestination({ type: "request_status", refId: null, target }, "mobile", [VIGIE], noLookup))
      .toBe("/extensions?section=seer%3A%2Frequests");
    expect(await resolveNotificationDestination({ type: "mystery", refId: null, target }, "mobile", [VIGIE], noLookup)).toBeNull();
  });

  it("une demande sans les métadonnées des extensions n'a pas de destination", async () => {
    expect(await resolveNotificationDestination({ type: "request_status", refId: "r1" }, "mobile", undefined, noLookup)).toBeNull();
  });
});

describe("decideNotificationTap", () => {
  it("les notifications locales du hors ligne ouvrent l'écran de l'appareil", () => {
    expect(decideNotificationTap({ type: "offline_ready" })).toEqual({ kind: "onDevice" });
    expect(decideNotificationTap({ type: "offline_disk_full" })).toEqual({ kind: "onDevice" });
  });

  it("une invitation de la Famille ouvre SON affiche ; sans référence, la page", () => {
    expect(decideNotificationTap({ type: "family_invite", refId: "inv1" })).toEqual({ kind: "familyPoster", invitationId: "inv1" });
    expect(decideNotificationTap({ type: "family_invite", refId: null })).toEqual({ kind: "route", needsPlugins: false });
  });

  it("dit quand il faut les extensions pour décider", () => {
    expect(notificationNeedsPlugins({ type: "request_status" })).toBe(true);
    expect(notificationNeedsPlugins({ type: "x", target: { kind: "extension", pluginId: "seer", path: "/a" } })).toBe(true);
    expect(notificationNeedsPlugins({ type: "x", target: { kind: "title", mediaType: "movie", tmdbId: 1, fallback: { kind: "extension", pluginId: "seer", path: "/a" } } })).toBe(true);
    expect(notificationNeedsPlugins({ type: "ticket_reply", target: { kind: "item", itemId: "a" } })).toBe(false);
    expect(decideNotificationTap({ type: "ticket_reply", refId: "t" })).toEqual({ kind: "route", needsPlugins: false });
  });
});

describe("notificationVisual / notificationAgo", () => {
  it("l'état prime, puis la famille du type", () => {
    expect(notificationVisual({ type: "request_status", state: "available" })).toEqual({ glyph: "available", tone: "success" });
    expect(notificationVisual({ type: "request_status", state: "bogus" })).toEqual({ glyph: "request", tone: null });
    expect(notificationVisual({ type: "ticket_new" }).glyph).toBe("ticket");
    expect(notificationVisual({ type: "family_dissolved" }).glyph).toBe("family");
    expect(notificationVisual({ type: "watchlist_share" }).glyph).toBe("watchlist");
    expect(notificationVisual({ type: "library_added" }).glyph).toBe("title");
    expect(notificationVisual({ type: "plugin_thing", target: { kind: "item", itemId: "a" } }).glyph).toBe("title");
    expect(notificationVisual({ type: "plugin_thing" }).glyph).toBe("generic");
  });

  it("relative tant que récente, puis la date", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(notificationAgo("2026-10-20T11:59:30Z", now)).toEqual({ unit: "now" });
    expect(notificationAgo("2026-10-20T11:55:00Z", now)).toEqual({ unit: "minutes", count: 5 });
    expect(notificationAgo("2026-10-20T09:00:00Z", now)).toEqual({ unit: "hours", count: 3 });
    expect(notificationAgo("2026-10-18T12:00:00Z", now)).toEqual({ unit: "days", count: 2 });
    expect(notificationAgo("2026-10-01T12:00:00Z", now).unit).toBe("date");
    expect(notificationAgo("pas une date", now)).toEqual({ unit: "now" });
  });
});
