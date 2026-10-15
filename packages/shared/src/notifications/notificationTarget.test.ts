import { describe, expect, it } from "vitest";
import {
  parseNotificationState,
  parseNotificationTarget,
  serializeNotificationTarget,
  type NotificationTarget,
} from "./notificationTarget";

describe("cible d'une notification", () => {
  it("lit les trois formes, en objet comme en JSON stocké", () => {
    const item: NotificationTarget = { kind: "item", itemId: "a1b2c3" };
    const ext: NotificationTarget = { kind: "extension", pluginId: "seer", path: "/discover", params: { tab: "requests", focus: "42" } };
    const title: NotificationTarget = { kind: "title", mediaType: "movie", tmdbId: 603, fallback: ext };
    for (const t of [item, ext, title]) {
      expect(parseNotificationTarget(t)).toEqual(t);
      expect(parseNotificationTarget(serializeNotificationTarget(t))).toEqual(t);
    }
  });

  it("refuse tout ce qui sort du contrat : la notification garde son comportement d'avant", () => {
    for (const raw of [
      null, "", "pas du json", "[]", { kind: "page" }, { kind: "item" }, { kind: "item", itemId: "../x" },
      { kind: "extension", pluginId: "Seer!", path: "/x" },
      { kind: "extension", pluginId: "seer", path: "discover" },
      { kind: "extension", pluginId: "seer", path: "/d?tab=x" },
      { kind: "extension", pluginId: "seer", path: "/d", params: { "a b": "x" } },
      { kind: "extension", pluginId: "seer", path: "/d", params: { a: { nested: true } } },
      { kind: "title", mediaType: "show", tmdbId: 1 },
      { kind: "title", mediaType: "tv", tmdbId: -3 },
      { kind: "title", mediaType: "tv", tmdbId: 3, fallback: { kind: "title", mediaType: "tv", tmdbId: 4 } },
    ]) {
      expect(parseNotificationTarget(raw)).toBeNull();
    }
  });

  it("garde les paramètres numériques en texte et refuse une cible trop longue", () => {
    expect(parseNotificationTarget({ kind: "extension", pluginId: "seer", path: "/d", params: { focus: 12 } }))
      .toEqual({ kind: "extension", pluginId: "seer", path: "/d", params: { focus: "12" } });
    const huge = { kind: "extension", pluginId: "seer", path: "/d", params: { q: "x".repeat(201) } } as NotificationTarget;
    expect(serializeNotificationTarget(huge)).toBeNull();
  });

  it("l'état est une liste fermée", () => {
    expect(parseNotificationState("progress")).toBe("progress");
    expect(parseNotificationState("downloading")).toBeNull();
    expect(parseNotificationState(undefined)).toBeNull();
  });
});
