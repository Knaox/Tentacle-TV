import { describe, expect, it } from "vitest";
import { describeSqlError, runStatements, SchemaStatementError, type SqlSession } from "./runStatements";

/** Une fausse session : les variables `SET @x := '…'` y sont gardées, tout le reste journalisé. */
function fakeSession(): SqlSession & { executed: string[] } {
  const variables = new Map<string, string>();
  const executed: string[] = [];
  return {
    executed,
    async execute(sql) {
      const set = /^SET\s+@(\w+)\s*:=\s*'(.*)'$/is.exec(sql);
      if (set) variables.set(set[1], set[2]);
      if (/^PREPARE|^EXECUTE|^DEALLOCATE/i.test(sql)) {
        throw new Error("This command is not supported in the prepared statement protocol yet");
      }
      executed.push(sql);
    },
    async readVariable(name) {
      return variables.get(name) ?? null;
    },
  };
}

describe("rejeu des instructions avec PREPARE émulé", () => {
  it("exécute le texte de la variable à la place de PREPARE/EXECUTE/DEALLOCATE", async () => {
    const session = fakeSession();
    await runStatements(session, [
      "CREATE TABLE IF NOT EXISTS t (id int)",
      "SET @t_sql := 'ALTER TABLE t ADD COLUMN c int'",
      "PREPARE t_stmt FROM @t_sql",
      "EXECUTE t_stmt",
      "DEALLOCATE PREPARE t_stmt",
    ]);
    expect(session.executed).toEqual([
      "CREATE TABLE IF NOT EXISTS t (id int)",
      "SET @t_sql := 'ALTER TABLE t ADD COLUMN c int'",
      "ALTER TABLE t ADD COLUMN c int",
    ]);
  });

  it("ignore la casse des noms préparés", async () => {
    const session = fakeSession();
    await runStatements(session, ["SET @v := 'DO 0'", "prepare S FROM @v", "execute s", "deallocate prepare S"]);
    expect(session.executed).toEqual(["SET @v := 'DO 0'", "DO 0"]);
  });

  it("s'arrête à la première instruction refusée et en donne le rang", async () => {
    const session = fakeSession();
    const err = await runStatements(session, ["SELECT 1", "EXECUTE inconnue", "SELECT 3"]).catch((e) => e);
    expect(err).toBeInstanceOf(SchemaStatementError);
    expect((err as SchemaStatementError).index).toBe(2);
    expect(session.executed).toEqual(["SELECT 1"]);
  });

  it("dit le texte de MariaDB que Prisma range dans meta, même quand son message est vide", () => {
    const prismaRefusal = Object.assign(new Error(""), {
      code: "P2010",
      meta: { code: "1050", message: "Table 'share_links' already exists" },
    });
    expect(describeSqlError(prismaRefusal)).toBe("Table 'share_links' already exists (1050)");
    expect(describeSqlError(new Error("connexion perdue"))).toBe("connexion perdue");
    expect(describeSqlError("brut")).toBe("brut");
  });

  it("refuse une variable vide plutôt que d'exécuter du vide", async () => {
    const err = await runStatements(fakeSession(), ["PREPARE s FROM @absente"]).catch((e) => e);
    expect(err).toBeInstanceOf(SchemaStatementError);
    expect(String(err.message)).toContain("@absente");
  });
});
