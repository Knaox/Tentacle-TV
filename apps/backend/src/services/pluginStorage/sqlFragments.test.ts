import { describe, expect, it, vi } from "vitest";
import { createStorageSql, msSinceLocalMidnight } from "./sqlFragments";
import { isSqliteBusy, withBusyRetry } from "./busyRetry";

const clock = () => new Date("2026-10-08T14:30:00.250Z");

describe("tournures MariaDB : le comportement d'avant", () => {
  const sql = createStorageSql("mysql", "iso8601", clock);

  it("l'horloge reste celle de la base", () => {
    expect(sql.now()).toBe("NOW(3)");
    expect(sql.shiftedNow(-7, "day")).toBe("DATE_ADD(NOW(3), INTERVAL -7 DAY)");
  });

  it("le début du jour suit le fuseau du serveur, pas celui de la base", () => {
    const micros = msSinceLocalMidnight(clock()) * 1000;
    expect(sql.startOfToday()).toBe(`DATE_SUB(NOW(3), INTERVAL ${micros} MICROSECOND)`);
  });

  it("upsert par ON DUPLICATE KEY UPDATE", () => {
    expect(sql.upsert({ table: "t", columns: ["k", "v"], conflict: ["k"], update: ["v"] }))
      .toBe("INSERT INTO t (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)");
    expect(sql.upsert({ table: "t", columns: ["k", "v"], conflict: ["k"], update: [] }))
      .toBe("INSERT INTO t (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE k = k");
    expect(sql.insertIgnore()).toBe("INSERT IGNORE");
  });
});

describe("tournures SQLite : l'instant calculé ici, au format de la base", () => {
  it("ISO 8601", () => {
    const sql = createStorageSql("sqlite", "iso8601", clock);
    expect(sql.now()).toBe("'2026-10-08T14:30:00.250Z'");
    expect(sql.shiftedNow(-1, "hour")).toBe("'2026-10-08T13:30:00.250Z'");
    expect(sql.dateParam(clock())).toBe("2026-10-08T14:30:00.250Z");
  });

  it("millisecondes epoch", () => {
    const sql = createStorageSql("sqlite", "epoch-ms", clock);
    expect(sql.now()).toBe(String(clock().getTime()));
    expect(sql.shiftedNow(2, "minute")).toBe(String(clock().getTime() + 120_000));
  });

  it("le début du jour est minuit, heure du serveur", () => {
    const sql = createStorageSql("sqlite", "epoch-ms", clock);
    const start = new Date(Number(sql.startOfToday()));
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect(start.getDate()).toBe(clock().getDate());
  });

  it("upsert par ON CONFLICT, et refus d'un nom douteux", () => {
    const sql = createStorageSql("sqlite", "iso8601", clock);
    expect(sql.upsert({ table: "t", columns: ["k", "v"], conflict: ["k"], update: [["v", "v + {new:v}"]] }))
      .toBe("INSERT INTO t (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = v + excluded.v");
    expect(() => sql.upsert({ table: "t;--", columns: ["k"], conflict: ["k"], update: [] })).toThrow(/identifiant refusé/);
    expect(() => sql.shiftedNow(Number.NaN, "day")).toThrow(/intervalle invalide/);
  });
});

describe("reprise sur SQLITE_BUSY", () => {
  it("reconnaît la base occupée, et rien d'autre", () => {
    expect(isSqliteBusy({ code: "SQLITE_BUSY" })).toBe(true);
    expect(isSqliteBusy(new Error("SqliteFailure: database is locked"))).toBe(true);
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
