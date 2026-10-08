import { describe, expect, it, vi } from "vitest";
import { createStorageSql, localMidnight, readDate } from "./sqlFragments";
import { isSqliteBusy, withBusyRetry } from "./busyRetry";

const clock = () => new Date("2026-10-08T14:30:00.250Z");
const sql = createStorageSql(clock);

describe("tournures SQLite : des dates en millisecondes entières", () => {
  it("maintenant et l'intervalle se calculent sur l'horloge de la base", () => {
    expect(sql.now()).toBe("CAST(unixepoch('subsec') * 1000 AS INTEGER)");
    expect(sql.shiftedNow(-1, "hour")).toBe("(CAST(unixepoch('subsec') * 1000 AS INTEGER) + -3600000)");
    expect(sql.dateParam(clock())).toBe(clock().getTime());
    expect(() => sql.shiftedNow(Number.NaN, "day")).toThrow(/intervalle invalide/);
  });

  it("le début du jour est minuit, heure du serveur", () => {
    const start = new Date(Number(sql.startOfToday()));
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect(start.getDate()).toBe(clock().getDate());
    expect(localMidnight(clock()).getTime()).toBe(start.getTime());
  });

  it("upsert : ON CONFLICT, une liste fermée d'expressions, et refus d'un nom douteux", () => {
    expect(sql.upsert({ table: "t", columns: ["k", "v"], conflict: ["k"], update: ["v", ["at", "now"]] }))
      .toBe("INSERT INTO t (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = CAST(unixepoch('subsec') * 1000 AS INTEGER)");
    expect(sql.upsert({ table: "t", columns: ["k"], rows: 2, conflict: ["k"], update: [] }))
      .toBe("INSERT INTO t (k) VALUES (?), (?) ON CONFLICT(k) DO NOTHING");
    expect(() => sql.upsert({ table: "t;--", columns: ["k"], conflict: ["k"], update: [] })).toThrow(/identifiant refusé/);
    expect(() => sql.upsert({ table: "t", columns: ["k"], conflict: ["k"], update: [["k", "1; DROP" as "now"]] }))
      .toThrow(/expression d'upsert refusée/);
    expect(() => sql.upsert({ table: "t", columns: ["k"], conflict: [], update: [] })).toThrow(/sans clé de conflit/);
    expect(sql.insertIgnore()).toBe("INSERT OR IGNORE");
  });

  it("relit une date sous toutes ses formes passées", () => {
    const ms = Date.UTC(2026, 9, 8, 12, 0, 0);
    expect(readDate(ms)?.getTime()).toBe(ms);
    expect(readDate(BigInt(ms))?.getTime()).toBe(ms);
    expect(readDate(String(ms))?.getTime()).toBe(ms);
    expect(readDate(new Date(ms))?.getTime()).toBe(ms);
    expect(readDate("2026-10-08 12:00:00")?.getTime()).toBe(ms);
    expect(readDate("2026-10-08T12:00:00.000Z")?.getTime()).toBe(ms);
    expect(readDate(null)).toBeNull();
    expect(readDate("pas une date")).toBeNull();
  });
});

describe("reprise quand la base est occupée", () => {
  it("reconnaît la base occupée et l'attente du pool, et rien d'autre", () => {
    expect(isSqliteBusy({ code: "SQLITE_BUSY" })).toBe(true);
    for (const code of ["P1008", "P2024", "P2028", "P2034"]) expect(isSqliteBusy({ code })).toBe(true);
    expect(isSqliteBusy(new Error("SqliteFailure: database is locked"))).toBe(true);
    expect(isSqliteBusy({ code: "P2002", message: "Unique constraint failed" })).toBe(false);
    expect(isSqliteBusy(new Error("UNIQUE constraint failed"))).toBe(false);
  });

  it("rejoue jusqu'à réussir, puis abandonne au-delà des essais", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const result = await withBusyRetry(async () => {
      if (++calls < 3) throw new Error("database is locked");
      return "ok";
    }, { sleep });
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalledTimes(2);
    await expect(withBusyRetry(async () => { throw new Error("database is locked"); }, { attempts: 2, sleep }))
      .rejects.toThrow("database is locked");
    await expect(withBusyRetry(async () => { throw new Error("autre"); }, { sleep })).rejects.toThrow("autre");
  });
});
