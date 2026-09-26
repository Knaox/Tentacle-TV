import { describe, expect, it } from "vitest";
import { parseDatabaseUrl, resolveDatabaseUrlSource } from "./databaseInfo";

describe("parseDatabaseUrl", () => {
  it("rend hôte, port, base et utilisateur — jamais le mot de passe", () => {
    expect(parseDatabaseUrl("mysql://ad%40min:secret@nas.local:3307/tentacle")).toEqual({
      host: "nas.local", port: 3307, database: "tentacle", user: "ad@min",
    });
  });

  it("prend le port MariaDB par défaut, et refuse ce qui n'est pas une URL", () => {
    expect(parseDatabaseUrl("mysql://u:p@db/tentacle")?.port).toBe(3306);
    expect(parseDatabaseUrl("pas une url")).toBeNull();
  });
});

describe("resolveDatabaseUrlSource", () => {
  const FILE = "mysql://u:p@db:3306/tentacle";
  const COMPOSE = "mysql://tentacle_user:x@db:3306/tentacle_db";

  it("docker-compose livré : l'environnement fournit une URL que le fichier n'a pas", () => {
    expect(resolveDatabaseUrlSource(COMPOSE, null, COMPOSE)).toBe("env");
    // Même après une modification depuis l'admin, qui écrit le fichier : au
    // redémarrage, l'environnement l'emporterait encore.
    expect(resolveDatabaseUrlSource(COMPOSE, FILE, FILE)).toBe("env");
  });

  it("image Docker sans DATABASE_URL : l'entrée recopie le fichier dans l'environnement", () => {
    expect(resolveDatabaseUrlSource(FILE, FILE, FILE)).toBe("file");
  });

  it("sans environnement : le fichier, ou rien du tout", () => {
    expect(resolveDatabaseUrlSource(null, FILE, FILE)).toBe("file");
    expect(resolveDatabaseUrlSource(null, null, null)).toBeNull();
    // Configurée par l'assistant après un démarrage à vide.
    expect(resolveDatabaseUrlSource(null, null, FILE)).toBe("file");
  });
});
