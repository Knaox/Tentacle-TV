import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "./splitSql";

describe("découpage d'un script SQL", () => {
  it("coupe sur les points-virgules et retire les blancs", () => {
    expect(splitSqlStatements("SELECT 1;\n  SELECT 2 ;\n\n")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("ignore un point-virgule dans une chaîne, des guillemets ou des accents graves", () => {
    const sql = "INSERT INTO t VALUES ('a;b', \"c;d\");\nCREATE TABLE `x;y` (id int);";
    expect(splitSqlStatements(sql)).toEqual([
      "INSERT INTO t VALUES ('a;b', \"c;d\")",
      "CREATE TABLE `x;y` (id int)",
    ]);
  });

  it("garde les quotes doublées et échappées dans la chaîne", () => {
    const sql = "SET @a := 'l''eau; et \\'plus\\'';\nSELECT 2;";
    expect(splitSqlStatements(sql)).toEqual(["SET @a := 'l''eau; et \\'plus\\''", "SELECT 2"]);
  });

  it("retire les commentaires, même porteurs d'un point-virgule", () => {
    const sql = "-- un; commentaire\nSELECT 1; # autre; commentaire\n/* bloc; */ SELECT 2;";
    expect(splitSqlStatements(sql)).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("ne prend pas `--` sans blanc pour un commentaire (règle MySQL)", () => {
    expect(splitSqlStatements("SELECT 1--1;")).toEqual(["SELECT 1--1"]);
  });

  it("découpe le vrai core-init.sql en 144 instructions, sans commentaire résiduel", () => {
    const file = resolve(__dirname, "../../../prisma/core-init.sql");
    const statements = splitSqlStatements(readFileSync(file, "utf-8"));
    expect(statements).toHaveLength(144);
    for (const statement of statements) {
      expect(statement.trimStart().startsWith("--")).toBe(false);
      expect(statement.endsWith(";")).toBe(false);
    }
    expect(statements.filter((s) => /^PREPARE\s/i.test(s))).toHaveLength(12);
  });
});
