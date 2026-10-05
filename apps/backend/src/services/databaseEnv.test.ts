import { describe, expect, it, vi } from "vitest";
import { databaseUrlFromEnv } from "./databaseEnv";

const noFile = () => {
  throw new Error("ENOENT");
};

describe("URL de la base depuis l'environnement", () => {
  it("garde DATABASE_URL telle quelle : les installations d'avant la posent", () => {
    expect(databaseUrlFromEnv({ DATABASE_URL: "mysql://a:b@h:3306/d", DB_HOST: "ignoré" }, noFile)).toBe(
      "mysql://a:b@h:3306/d",
    );
  });

  it("rien sans hôte : le serveur passe en mode installation", () => {
    expect(databaseUrlFromEnv({}, noFile)).toBeNull();
    expect(databaseUrlFromEnv({ DB_PASSWORD_FILE: "/run/x" }, noFile)).toBeNull();
  });

  it("compose l'URL avec le mot de passe du fichier, sans son saut de ligne", () => {
    const read = vi.fn(() => "s3cr3t\n");
    expect(databaseUrlFromEnv({ DB_HOST: "db", DB_PASSWORD_FILE: "/run/tentacle-secrets/db_password" }, read)).toBe(
      "mysql://tentacle:s3cr3t@db:3306/tentacle",
    );
    expect(read).toHaveBeenCalledWith("/run/tentacle-secrets/db_password");
  });

  it("encode ce qu'une URL ne peut porter tel quel", () => {
    const url = databaseUrlFromEnv(
      { DB_HOST: "db", DB_PORT: "3307", DB_NAME: "ma base", DB_USER: "u@x", DB_PASSWORD: "p/a:s@s#" },
      noFile,
    );
    expect(url).toBe("mysql://u%40x:p%2Fa%3As%40s%23@db:3307/ma%20base");
    const parsed = new URL(url!);
    expect(decodeURIComponent(parsed.password)).toBe("p/a:s@s#");
    expect(decodeURIComponent(parsed.username)).toBe("u@x");
  });

  it("préfère DB_PASSWORD au fichier", () => {
    expect(databaseUrlFromEnv({ DB_HOST: "db", DB_PASSWORD: "direct", DB_PASSWORD_FILE: "/x" }, () => "fichier")).toBe(
      "mysql://tentacle:direct@db:3306/tentacle",
    );
  });

  it("fichier illisible : pas d'URL, et le journal le dit", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(databaseUrlFromEnv({ DB_HOST: "db", DB_PASSWORD_FILE: "/absent" }, noFile)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("/absent"));
    warn.mockRestore();
  });
});
