import { describe, expect, it } from "vitest";
import { afterKey } from "./mariadbReader";
import { connectionOptions, describeSource, isMariadbUrl, resolveLegacySource } from "./sourceConfig";
import { sourceZoneForConversion, zonePolicy } from "./timeZones";

describe("source MariaDB : configuration", () => {
  const noFile = () => {
    throw new Error("absent");
  };

  it("DATABASE_URL en mysql:// d'abord, une URL file: n'est pas une source", () => {
    expect(resolveLegacySource({ DATABASE_URL: "mysql://u:p@db:3306/t" }, "/nulle-part", noFile)).toEqual({
      url: "mysql://u:p@db:3306/t",
      origin: "env-url",
    });
    expect(resolveLegacySource({ DATABASE_URL: "file:/data/tentacle.db" }, "/nulle-part", noFile)).toBeNull();
    expect(isMariadbUrl("mariadb://h/x")).toBe(true);
  });

  it("les variables DB_* des piles, mot de passe lu dans son fichier (sans le saut de ligne)", () => {
    const src = resolveLegacySource({ DB_HOST: "db", DB_PASSWORD_FILE: "/run/secrets/pw" }, "/x", (p) => {
      expect(p).toBe("/run/secrets/pw");
      return "s3cr:et@\n";
    });
    expect(src?.origin).toBe("env-vars");
    expect(connectionOptions(src!.url)).toEqual({ host: "db", port: 3306, user: "tentacle", password: "s3cr:et@", database: "tentacle" });
  });

  it("un mot de passe illisible ne donne pas de source (rien de tenté à l'aveugle)", () => {
    expect(resolveLegacySource({ DB_HOST: "db", DB_PASSWORD_FILE: "/absent" }, "/nulle-part", noFile)).toBeNull();
  });

  it("le journal ne dit que l'hôte, le port et la base — jamais l'utilisateur ni le mot de passe", () => {
    expect(describeSource("mysql://root:tr%C3%A8s-secret@10.0.0.5:3307/tentacle")).toBe("10.0.0.5:3307/tentacle");
  });
});

describe("lecture par pages sur la clé", () => {
  it("clé simple : col > ?", () => {
    expect(afterKey(["id"], ["k9"])).toEqual({ clause: "(`id` > ?)", params: ["k9"] });
  });

  it("clé composée : a > x OR (a = x AND b > y) — la forme que MariaDB indexe", () => {
    expect(afterKey(["media_type", "tmdb_id"], ["movie", 42])).toEqual({
      clause: "(`media_type` > ?) OR (`media_type` = ? AND `tmdb_id` > ?)",
      params: ["movie", "movie", 42],
    });
  });
});

describe("fuseau de la source (GENERIC-COPY.md)", () => {
  it("UTC sous toutes ses formes : aucune conversion", () => {
    expect(sourceZoneForConversion("SYSTEM", "UTC")).toBeNull();
    expect(sourceZoneForConversion("+00:00", "CEST")).toBeNull();
    expect(sourceZoneForConversion("Etc/UTC", "")).toBeNull();
  });

  it("un fuseau local : SYSTEM gardé tel quel, un fuseau nommé ou décalé aussi", () => {
    expect(sourceZoneForConversion("SYSTEM", "CEST")).toBe("SYSTEM");
    expect(sourceZoneForConversion("Europe/Paris", "UTC")).toBe("Europe/Paris");
    expect(sourceZoneForConversion("+02:00", "UTC")).toBe("+02:00");
  });

  it("cœur en UTC sauf content_claims ; extensions en « session » sauf les dates JS de Vigie", () => {
    expect(zonePolicy("notifications", "createdAt", true)).toBe("utc");
    expect(zonePolicy("content_claims", "expiresAt", true)).toBe("session");
    expect(zonePolicy("content_claims", "tmdbId", true)).toBe("utc");
    expect(zonePolicy("seer_requests", "created_at", false)).toBe("session");
    expect(zonePolicy("seer_requests", "sent_at", false)).toBe("session");
    expect(zonePolicy("seer_tmdb_cache", "expires_at", false)).toBe("utc");
    expect(zonePolicy("seer_user_settings", "jellyseerr_last_sync", false)).toBe("utc");
    expect(zonePolicy("extension_inconnue", "quand", false)).toBe("session");
  });
});
