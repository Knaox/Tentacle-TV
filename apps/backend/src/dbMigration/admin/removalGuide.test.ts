import { describe, expect, it } from "vitest";
import { dropDatabaseCommand, removalGuide } from "./removalGuide";

const id = (host: string, database = "tentacle") => ({ host, port: 3306, database });

describe("retirer l'ancienne MariaDB : l'installation détectée, sans parler à Docker", () => {
  it("pile officielle (TENTACLE_STACK full ou db) : son service db", () => {
    expect(removalGuide({ TENTACLE_STACK: "full", DB_HOST: "db" }, id("db"), true)).toMatchObject({ kind: "official-stack", stack: "full", dbService: "db" });
    expect(removalGuide({ TENTACLE_STACK: "db" }, id("mariadb"), true)).toMatchObject({ kind: "official-stack", dbService: "mariadb" });
  });

  it("un service MariaDB de la même pile (nom de service, dans un conteneur)", () => {
    expect(removalGuide({ DB_HOST: "tentacle-db" }, id("tentacle-db"), true)).toMatchObject({ kind: "compose-service", dbService: "tentacle-db" });
  });

  it("base EXTERNE : adresse IP, nom de domaine, socket, ou installation native — et la commande à copier", () => {
    for (const host of ["192.168.1.20", "nas.local", "mariadb.example.org", "socket:/run/mysqld/mysqld.sock"]) {
      expect(removalGuide({}, id(host), true).kind).toBe("external");
    }
    expect(removalGuide({}, id("db"), false).kind).toBe("external");
    expect(dropDatabaseCommand("tentacle")).toBe("DROP DATABASE `tentacle`;");
    expect(dropDatabaseCommand("ma`base")).toBe("DROP DATABASE `ma``base`;");
  });

  it("dans le doute : tous les onglets", () => {
    expect(removalGuide({}, null, true).kind).toBe("unknown");
  });
});
