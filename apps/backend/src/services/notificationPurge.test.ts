/**
 * La purge de la cloche : au-delà de 30 jours, une notification quitte la base,
 * lue ou non ; en deçà, rien ne bouge.
 */

import { describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  read: boolean;
  createdAt: Date;
}
const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 8, 24, 12);
const rows: Row[] = [
  { id: "fresh", read: false, createdAt: new Date(NOW - 2 * DAY) },
  { id: "edge", read: true, createdAt: new Date(NOW - 30 * DAY + 60_000) },
  { id: "old-read", read: true, createdAt: new Date(NOW - 31 * DAY) },
  { id: "old-unread", read: false, createdAt: new Date(NOW - 90 * DAY) },
];

vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    notification: {
      deleteMany: async (args: { where: { createdAt: { lt: Date } } }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].createdAt < args.where.createdAt.lt) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      },
    },
  }),
}));

import { purgeExpiredNotifications } from "./notificationPurge";

describe("purge des notifications de la cloche", () => {
  it("supprime au-delà de 30 jours, lues ou non, et garde le reste", async () => {
    const count = await purgeExpiredNotifications(NOW);
    expect(count).toBe(2);
    expect(rows.map((r) => r.id)).toEqual(["fresh", "edge"]);
  });

  it("un second passage ne trouve plus rien", async () => {
    expect(await purgeExpiredNotifications(NOW)).toBe(0);
  });
});
