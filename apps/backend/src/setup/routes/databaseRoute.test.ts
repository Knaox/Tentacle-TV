import { describe, expect, it } from "vitest";
import { databaseErrorCode, databaseUrl } from "./databaseRoute";

describe("databaseUrl", () => {
  it("encode le compte, le mot de passe et la base", () => {
    expect(databaseUrl({ host: "db", port: 3306, database: "tentacle", user: "u@x", password: "p:/@#" })).toBe(
      "mysql://u%40x:p%3A%2F%40%23@db:3306/tentacle",
    );
  });

  it("met une adresse IPv6 entre crochets", () => {
    expect(databaseUrl({ host: "fd00::5", port: 3306, database: "t", user: "u", password: "p" })).toBe("mysql://u:p@[fd00::5]:3306/t");
  });
});

describe("databaseErrorCode", () => {
  it("dit chaque refus de MariaDB en un code (relevés sur MariaDB 11.8)", () => {
    expect(databaseErrorCode({ errorCode: "P1000" })).toBe("db_auth_failed");
    // root : la base n'existe pas ; un compte ordinaire : accès refusé à la base.
    expect(databaseErrorCode({ errorCode: "P1003" })).toBe("db_unknown_database");
    expect(databaseErrorCode({ errorCode: "P1010" })).toBe("db_unknown_database");
    expect(databaseErrorCode({ errorCode: "P1001" })).toBe("db_unreachable");
    expect(databaseErrorCode(new Error("rien"))).toBe("db_unreachable");
  });
});
