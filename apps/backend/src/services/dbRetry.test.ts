import { describe, expect, it, vi } from "vitest";
import { isWriteConflict, retryOnWriteConflict } from "./dbRetry";

/** Ce que Prisma rend quand un autre processus tient le verrou au-delà du busy_timeout (mesuré). */
const busy = Object.assign(new Error("Socket timeout (the database failed to respond to a query within the configured timeout)."), {
  code: "P1008",
});

describe("écriture qui n'a pas pu passer (SQLite)", () => {
  it("reconnaît l'attente du verrou, de la file, et SQLITE_BUSY ; jamais une autre erreur", () => {
    expect(isWriteConflict(busy)).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("Transaction API error: Unable to start a transaction in the given time."), { code: "P2028" }))).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("Transaction already closed: A query cannot be executed on an expired transaction."), { code: "P2028" }))).toBe(false);
    expect(isWriteConflict(Object.assign(new Error("Timed out fetching a new connection from the connection pool."), { code: "P2024" }))).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("Transaction failed"), { code: "P2034" }))).toBe(true);
    expect(isWriteConflict(new Error("SqliteError: database is locked"))).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("contrainte unique"), { code: "P2002" }))).toBe(false);
    expect(isWriteConflict(new Error("Jellyfin muet"))).toBe(false);
  });

  it("relit et rejoue la tâche entière", async () => {
    const task = vi.fn().mockRejectedValueOnce(busy).mockResolvedValueOnce("échangée");
    await expect(retryOnWriteConflict(task)).resolves.toBe("échangée");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue jamais une autre erreur, et s'arrête au bout de ses essais", async () => {
    const other = vi.fn().mockRejectedValue(new Error("Jellyfin muet"));
    await expect(retryOnWriteConflict(other)).rejects.toThrow("Jellyfin muet");
    expect(other).toHaveBeenCalledTimes(1);
    const always = vi.fn().mockRejectedValue(busy);
    await expect(retryOnWriteConflict(always, 3)).rejects.toBe(busy);
    expect(always).toHaveBeenCalledTimes(3);
  });
});
