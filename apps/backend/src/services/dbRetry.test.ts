import { describe, expect, it, vi } from "vitest";
import { isWriteConflict, retryOnWriteConflict } from "./dbRetry";

/** L'erreur que Prisma rend sur le refus de MariaDB 11 (vue en vrai, Jellyfin 12.1 compat). */
const mariadb1020 = Object.assign(
  new Error(
    "Invalid `tx.pairedDevice.update()` invocation: Error occurred during query execution: " +
      'MysqlError { code: 1020, message: "Record has changed since last read in table \'paired_devices\'; try restarting transaction" }',
  ),
  { name: "PrismaClientUnknownRequestError" },
);

describe("conflit d'écriture", () => {
  it("reconnaît le refus 1020 de MariaDB, l'interblocage, et P2034", () => {
    expect(isWriteConflict(mariadb1020)).toBe(true);
    expect(isWriteConflict(new Error("Deadlock found when trying to get lock; try restarting transaction"))).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("Transaction failed"), { code: "P2034" }))).toBe(true);
    expect(isWriteConflict(Object.assign(new Error("contrainte unique"), { code: "P2002" }))).toBe(false);
    expect(isWriteConflict(new Error("Jellyfin muet"))).toBe(false);
  });

  it("relit et rejoue la tâche entière sur un conflit", async () => {
    const task = vi.fn().mockRejectedValueOnce(mariadb1020).mockResolvedValueOnce("échangée");
    await expect(retryOnWriteConflict(task)).resolves.toBe("échangée");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue jamais une autre erreur, et s'arrête au bout de ses essais", async () => {
    const other = vi.fn().mockRejectedValue(new Error("Jellyfin muet"));
    await expect(retryOnWriteConflict(other)).rejects.toThrow("Jellyfin muet");
    expect(other).toHaveBeenCalledTimes(1);
    const always = vi.fn().mockRejectedValue(mariadb1020);
    await expect(retryOnWriteConflict(always, 3)).rejects.toBe(mariadb1020);
    expect(always).toHaveBeenCalledTimes(3);
  });
});
