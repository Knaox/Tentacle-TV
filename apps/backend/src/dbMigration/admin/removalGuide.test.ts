import { describe, expect, it } from "vitest";
import { dropDatabaseCommand, forgetSourceCommand, removalGuide } from "./removalGuide";

const id = (host: string, database = "tentacle") => ({ host, port: 3306, database });

describe("retirer l'ancienne MariaDB : l'installation détectée, sans parler à Docker", () => {
  it("pile officielle d'avant (TENTACLE_STACK full ou db, base désignée par DB_HOST) : son service, et sa remplaçante d'aujourd'hui", () => {
    expect(removalGuide({ TENTACLE_STACK: "full", DB_HOST: "db" }, id("db"), true, "env")).toMatchObject({
      kind: "official-stack",
      stack: "full",
      newStack: "tentacle-full",
      dbService: "db",
      origin: "env",
    });
    expect(removalGuide({ TENTACLE_STACK: "db", DB_HOST: "db" }, id("db"), true, "env")).toMatchObject({ kind: "official-stack", newStack: "tentacle-only" });
  });

  it("jamais d'après TENTACLE_STACK seul : la pile d'aujourd'hui dit « full » sans base, le fichier de l'ancien assistant n'est pas son service", () => {
    expect(removalGuide({ TENTACLE_STACK: "full" }, null, true, null)).toMatchObject({ kind: "unknown", newStack: null });
    expect(removalGuide({ TENTACLE_STACK: "full" }, id("192.168.1.20"), true, "file")).toMatchObject({ kind: "external", newStack: null, origin: "file" });
    expect(removalGuide({ TENTACLE_STACK: "only" }, id("mariadb"), true, "file")).toMatchObject({ kind: "compose-service", dbService: "mariadb" });
    expect(removalGuide({ TENTACLE_STACK: "full", DB_HOST: "10.0.0.5" }, id("10.0.0.5"), true, "env").kind).toBe("external");
  });

  it("un service MariaDB de la même pile (nom de service, dans un conteneur)", () => {
    expect(removalGuide({ DB_HOST: "tentacle-db" }, id("tentacle-db"), true, "env")).toMatchObject({ kind: "compose-service", dbService: "tentacle-db" });
  });

  it("base EXTERNE : adresse IP, nom de domaine, socket, ou installation native — et la commande à copier", () => {
    for (const host of ["192.168.1.20", "nas.local", "mariadb.example.org", "socket:/run/mysqld/mysqld.sock"]) {
      expect(removalGuide({}, id(host), true, "env").kind).toBe("external");
    }
    expect(removalGuide({}, id("db"), false, "env").kind).toBe("external");
    expect(dropDatabaseCommand("tentacle")).toBe("DROP DATABASE `tentacle`;");
    expect(dropDatabaseCommand("ma`base")).toBe("DROP DATABASE `ma``base`;");
  });

  it("le fichier de l'ancien assistant : la commande pour le supprimer, son chemin cité si besoin", () => {
    expect(forgetSourceCommand("/app/apps/backend/data/database.json")).toBe("rm /app/apps/backend/data/database.json");
    expect(forgetSourceCommand("/srv/mes données/database.json")).toBe("rm '/srv/mes données/database.json'");
    expect(forgetSourceCommand("/srv/l'été/database.json")).toBe("rm '/srv/l'\\''été/database.json'");
  });

  it("dans le doute : tous les onglets", () => {
    expect(removalGuide({}, null, true).kind).toBe("unknown");
  });
});
