import { describe, expect, it } from "vitest";
import { groupNotificationsByDay, groupNotificationsByPeriod } from "./notificationGroups";

const now = new Date(2026, 9, 20, 15, 0);
const at = (d: number, h = 10) => ({ createdAt: new Date(2026, 9, d, h, 0).toISOString() });

describe("groupNotificationsByPeriod", () => {
  it("Aujourd'hui, Hier, Cette semaine, Plus tôt — dans l'ordre servi, sans groupe vide", () => {
    const list = [at(20, 9), at(19, 23), at(19, 1), at(15), at(14), at(2)];
    const groups = groupNotificationsByPeriod(list, now);
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([["today", 1], ["yesterday", 2], ["week", 2], ["earlier", 1]]);
  });

  it("une date illisible tombe dans Plus tôt", () => {
    expect(groupNotificationsByPeriod([{ createdAt: "?" }], now)).toEqual([{ group: "earlier", items: [{ createdAt: "?" }] }]);
  });

  it("le regroupement du bureau garde ses deux groupes", () => {
    expect(groupNotificationsByDay([at(20), at(19)], now).map((g) => g.group)).toEqual(["today", "earlier"]);
  });
});
