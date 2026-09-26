/**
 * Les mises en forme de la page Invitations : l'unité du temps relatif, le
 * tri (valables d'abord) et le décompte des filtres.
 */

import { describe, expect, it } from "vitest";
import type { AdminInviteDto } from "@tentacle-tv/shared";
import { countByStatus, expiresSoon, formatDeadline, relativeTime, sortInvites } from "./inviteFormat";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function invite(id: string, over: Partial<AdminInviteDto> = {}): AdminInviteDto {
  return {
    id, key: `${id}0000000000000`.slice(0, 16), maxUses: 1, currentUses: 0, expiresAt: null,
    createdAt: "2026-09-20T12:00:00Z", createdBy: "root", usages: [], ...over,
  };
}

describe("relativeTime", () => {
  it("sous la minute, rien : la page dit « à l'instant »", () => {
    expect(relativeTime(NOW - 30_000, NOW, "fr")).toBeNull();
    expect(relativeTime(NOW + 59_000, NOW, "fr")).toBeNull();
  });

  it("minutes, heures, puis jours", () => {
    expect(relativeTime(NOW + 5 * MIN, NOW, "fr")).toBe("dans 5 minutes");
    expect(relativeTime(NOW - 2 * HOUR, NOW, "fr")).toBe("il y a 2 heures");
    expect(relativeTime(NOW + 3 * DAY, NOW, "en")).toBe("in 3 days");
  });

  it("arrondit vers l'unité supérieure au bord : 71 h 59 se lit « dans 3 jours »", () => {
    expect(relativeTime(NOW + 3 * DAY - MIN, NOW, "fr")).toBe("dans 3 jours");
    expect(relativeTime(NOW + DAY - MIN, NOW, "fr")).toBe("demain");
    expect(relativeTime(NOW - DAY, NOW, "en")).toBe("yesterday");
  });

  it("mois puis années pour les vieilles invitations", () => {
    expect(relativeTime(NOW - 60 * DAY, NOW, "fr")).toBe("il y a 2 mois");
    expect(relativeTime(NOW - 400 * DAY, NOW, "en")).toBe("last year");
  });
});

describe("formatDeadline", () => {
  it("l'heure à deux chiffres en français, à l'anglaise en anglais", () => {
    const midnight = new Date(2026, 9, 4, 0, 1).getTime();
    expect(formatDeadline(midnight, "fr")).toBe("dimanche 4 octobre 2026 à 00:01");
    expect(formatDeadline(midnight, "en")).toBe("Sunday, October 4, 2026 at 12:01 AM");
  });
});

describe("expiresSoon", () => {
  it("moins d'un jour avant l'échéance, et pas après", () => {
    expect(expiresSoon({ expiresAt: new Date(NOW + 5 * HOUR).toISOString() }, NOW)).toBe(true);
    expect(expiresSoon({ expiresAt: new Date(NOW + 2 * DAY).toISOString() }, NOW)).toBe(false);
    expect(expiresSoon({ expiresAt: new Date(NOW - HOUR).toISOString() }, NOW)).toBe(false);
    expect(expiresSoon({ expiresAt: null }, NOW)).toBe(false);
  });
});

describe("tri et décompte", () => {
  const list = [
    invite("old-active", { createdAt: "2026-09-01T00:00:00Z" }),
    invite("expired", { createdAt: "2026-09-25T00:00:00Z", expiresAt: "2026-09-26T00:00:00Z" }),
    invite("exhausted", { createdAt: "2026-09-24T00:00:00Z", currentUses: 1 }),
    invite("new-active", { createdAt: "2026-09-26T11:00:00Z", maxUses: 5, currentUses: 2 }),
  ];

  it("les valables d'abord, la plus récente en tête de chaque groupe", () => {
    expect(sortInvites(list, NOW).map((i) => i.id)).toEqual(["new-active", "old-active", "expired", "exhausted"]);
  });

  it("compte chaque statut une fois, et le tout", () => {
    expect(countByStatus(list, NOW)).toEqual({ all: 4, active: 2, expired: 1, exhausted: 1 });
  });
});
