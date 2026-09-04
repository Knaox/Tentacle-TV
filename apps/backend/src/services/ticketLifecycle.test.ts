import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: string; subject: string; jellyfinUserId: string; status: string; updatedAt: Date }
const rows = new Map<string, Row>();
const notified: unknown[][] = [];

vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    supportTicket: {
      findMany: async (args: { where: { status: string; updatedAt: { lt: Date } } }) =>
        [...rows.values()].filter((r) => r.status === args.where.status && r.updatedAt < args.where.updatedAt.lt),
      update: async (args: { where: { id: string }; data: Partial<Row> }) => {
        const row = { ...rows.get(args.where.id)!, ...args.data };
        rows.set(row.id, row);
        return row;
      },
    },
  }),
}));
vi.mock("./ticketNotifier", () => ({
  notifyTicketOwner: async (...args: unknown[]) => { notified.push(args); },
}));

import { AUTO_CLOSE_AFTER_MS, HIDE_CLOSED_AFTER_MS, autoCloseResolvedTickets, visibleTicketsWhere } from "./ticketLifecycle";

const NOW = Date.parse("2026-09-05T12:00:00Z");
const DAY = 24 * 3600_000;
const ticket = (id: string, status: string, ageMs: number): Row => ({
  id, subject: `Sujet ${id}`, jellyfinUserId: `u-${id}`, status, updatedAt: new Date(NOW - ageMs),
});

beforeEach(() => { rows.clear(); notified.length = 0; });

describe("fermeture automatique des tickets résolus", () => {
  it("ferme ceux résolus depuis plus de sept jours, notifie l'auteur, rafraîchit la date", async () => {
    rows.set("vieux", ticket("vieux", "resolved", 8 * DAY));
    rows.set("recent", ticket("recent", "resolved", 6 * DAY));
    rows.set("ouvert", ticket("ouvert", "open", 30 * DAY));
    expect(await autoCloseResolvedTickets(NOW)).toBe(1);
    expect(rows.get("vieux")).toMatchObject({ status: "closed", updatedAt: new Date(NOW) });
    expect(rows.get("recent")?.status).toBe("resolved");
    expect(rows.get("ouvert")?.status).toBe("open");
    expect(notified).toHaveLength(1);
    expect(notified[0][0]).toMatchObject({ id: "vieux", jellyfinUserId: "u-vieux" });
    expect(notified[0].slice(1, 3)).toEqual(["ticket_status", "closed"]);
  });

  it("le délai est de sept jours des deux côtés", () => {
    expect(AUTO_CLOSE_AFTER_MS).toBe(7 * DAY);
    expect(HIDE_CLOSED_AFTER_MS).toBe(7 * DAY);
  });
});

describe("tickets visibles", () => {
  it("garde tout ce qui n'est pas fermé, et les fermés de moins de sept jours", () => {
    const where = visibleTicketsWhere(NOW);
    const matches = (r: Row) => where.OR.some((c) =>
      "status" in c ? r.status !== c.status.not : r.updatedAt >= c.updatedAt.gte);
    expect(matches(ticket("a", "open", 90 * DAY))).toBe(true);
    expect(matches(ticket("b", "closed", 6 * DAY))).toBe(true);
    expect(matches(ticket("c", "closed", 8 * DAY))).toBe(false);
  });
});
