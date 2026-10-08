import { describe, expect, it } from "vitest";
import { afterKey } from "./mariadbReader";
import { connectionOptions, describeSource, ignoredParams, isMariadbUrl, SourceConfigError, tlsWithoutVerification } from "./sourceConfig";
import { sourceZoneForConversion, zonePolicy } from "./timeZones";

describe("source MariaDB : l'URL relue comme la 1.24 la donnait à Prisma", () => {
  const files = (path: string) => Buffer.from(`contenu de ${path}`);

  it("une URL file: n'est pas une source ; mysql:// et mariadb:// le sont", () => {
    expect(isMariadbUrl("file:/data/tentacle.db")).toBe(false);
    expect(isMariadbUrl("mysql://u:p@db:3306/t")).toBe(true);
    expect(isMariadbUrl("mariadb://h/x")).toBe(true);
  });

  it("port non standard, caractères spéciaux encodés, délais par défaut bornés, pas de TLS non demandé", () => {
    expect(connectionOptions("mysql://tentacle:s3cr%3Aet%40%2F%23@nas.local:3307/ma%20base", files)).toEqual({
      host: "nas.local",
      port: 3307,
      user: "tentacle",
      password: "s3cr:et@/#",
      database: "ma base",
      connectTimeout: 10_000,
      socketTimeout: 60_000,
      allowPublicKeyRetrieval: true,
    });
  });

  it("MySQL 8 (caching_sha2_password, sans TLS) : la clé publique du serveur se demande, comme le faisait Prisma", () => {
    expect(connectionOptions("mysql://root:pw@mysql8:3306/tentacle", files).allowPublicKeyRetrieval).toBe(true);
  });

  it("TLS demandé (sslaccept, sslcert ou sslidentity) : JAMAIS de clé demandée — le canal chiffré suffit", () => {
    for (const query of ["sslaccept=strict", "sslcert=/certs/ca.pem", "sslidentity=/id.p12&sslpassword=pw", "sslaccept=accept_invalid_certs"]) {
      expect(connectionOptions(`mysql://u:p@db/t?${query}`, files).allowPublicKeyRetrieval, query).toBe(false);
    }
  });

  it("un TLS sans vérification du certificat se reconnaît, pour être dit au journal", () => {
    expect(tlsWithoutVerification("mysql://u:p@db/t?sslaccept=accept_invalid_certs")).toBe(true);
    expect(tlsWithoutVerification("mysql://u:p@db/t?sslaccept=strict")).toBe(false);
    expect(tlsWithoutVerification("mysql://u:p@db/t")).toBe(false);
  });

  it("la moindre demande de TLS le rend OBLIGATOIRE, certificat relu, jamais de repli en clair", () => {
    expect(connectionOptions("mysql://u:p@db/t?sslaccept=strict", files).ssl).toEqual({ rejectUnauthorized: true });
    expect(connectionOptions("mysql://u:p@db/t?sslcert=/certs/ca.pem", files).ssl).toEqual({
      rejectUnauthorized: true,
      ca: Buffer.from("contenu de /certs/ca.pem"),
    });
    const relative = connectionOptions("mysql://u:p@db/t?sslcert=certs/ca.pem&sslaccept=accept_invalid_certs", files).ssl!;
    expect(relative.rejectUnauthorized).toBe(false);
    expect(String(relative.ca)).toMatch(/prisma\/certs\/ca\.pem$/);
    expect(connectionOptions("mysql://u:p@db/t?sslidentity=/id.p12&sslpassword=pw", files).ssl).toEqual({
      rejectUnauthorized: true,
      pfx: Buffer.from("contenu de /id.p12"),
      passphrase: "pw",
    });
  });

  it("un certificat illisible ou un sslaccept inconnu : refus clair, aucune connexion tentée", () => {
    const unreadable = () => {
      throw new Error("ENOENT");
    };
    expect(() => connectionOptions("mysql://u:p@db/t?sslcert=/absent.pem", unreadable)).toThrow(SourceConfigError);
    expect(() => connectionOptions("mysql://u:p@db/t?sslaccept=maybe", files)).toThrow(/sslaccept/);
  });

  it("délais, socket Unix ; réglages de pool ignorés (et dits) ; paramètre inconnu refusé", () => {
    const o = connectionOptions("mysql://u:p@localhost/t?connect_timeout=5&socket_timeout=30&socket=/run/mysqld/mysqld.sock&connection_limit=1", files);
    expect(o).toMatchObject({ connectTimeout: 5000, socketTimeout: 30_000, socketPath: "/run/mysqld/mysqld.sock" });
    expect(ignoredParams("mysql://u:p@db/t?connection_limit=5&pool_timeout=2")).toEqual(["connection_limit", "pool_timeout"]);
    expect(() => connectionOptions("mysql://u:p@db/t?sslmode=require", files)).toThrow(/inconnu « sslmode »/);
    expect(() => connectionOptions("mysql://u:p@db/t?connect_timeout=abc", files)).toThrow(SourceConfigError);
  });

  it("le journal ne dit que l'hôte, le port, la base et le TLS — jamais l'utilisateur ni le mot de passe", () => {
    expect(describeSource("mysql://root:tr%C3%A8s-secret@10.0.0.5:3307/tentacle")).toBe("10.0.0.5:3307/tentacle");
    expect(describeSource("mysql://root:x@db/tentacle?sslaccept=strict")).toBe("db:3306/tentacle, TLS");
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
