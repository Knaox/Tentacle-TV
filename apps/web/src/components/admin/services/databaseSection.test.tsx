import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readServices } from "./servicesModel";

/**
 * La carte « Base de données » des Services : en lecture seule, toujours.
 * SQLite (serveur 1.25 et après) — moteur, version, fichier, taille, état, et
 * l'avertissement du partage réseau ; MariaDB (serveur d'avant) — sa
 * connexion, sans formulaire.
 */
const h = vi.hoisted(() => ({ raw: {} as object }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "fr", language: "fr" } }),
}));
vi.mock("./useServicesData", () => ({
  useServicesStatus: () => ({ data: readServices({ database: h.raw }), isError: false, refetch: async () => undefined }),
}));

const { DatabaseSection } = await import("./DatabaseSection");

const SQLITE = {
  status: "connected",
  version: "3.46.0",
  engine: "sqlite",
  path: "/app/apps/backend/data/tentacle.db",
  sizeBytes: 14_500_000,
  storage: "local",
  // Ce qu'un serveur SQLite garde pour l'admin d'avant 1.25 : sans effet ici.
  source: "env",
  fromEnv: true,
  pendingRestart: false,
};

const html = () => renderToStaticMarkup(<DatabaseSection />).replace(/\s/g, " ");

beforeEach(() => {
  h.raw = SQLITE;
});

describe("la carte « Base de données »", () => {
  it("SQLite : moteur, version, fichier, taille — et aucun champ à remplir", () => {
    const out = html();
    expect(out).toContain("databaseDescription");
    expect(out).toContain("SQLite");
    expect(out).toContain("3.46.0");
    expect(out).toContain("/app/apps/backend/data/tentacle.db");
    expect(out).toContain('title="/app/apps/backend/data/tentacle.db"');
    expect(out).toContain("14,5 Mo");
    expect(out).toContain("databaseConnected");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("databaseNetwork");
  });

  it("sur un partage réseau : l'avertissement, et ce qu'il faut faire", () => {
    h.raw = { ...SQLITE, storage: "network" };
    const out = html();
    expect(out).toContain("databaseNetworkTitle");
    expect(out).toContain("databaseOnNetwork");
  });

  it("une base qui ne s'ouvre pas : l'état, et la cause telle que le serveur la dit", () => {
    h.raw = { ...SQLITE, status: "error", version: "", sizeBytes: 0, error: "unable to open database file" };
    const out = html();
    expect(out).toContain("databaseWontOpen");
    expect(out).toContain("databaseErrorTitle");
    expect(out).toContain("unable to open database file");
    expect(out).not.toContain("0 octet");
  });

  it("sans cause donnée : renvoi aux journaux du serveur", () => {
    h.raw = { ...SQLITE, status: "error" };
    expect(html()).toContain("databaseErrorLogs");
  });

  it("serveur d'avant 1.25 (MariaDB) : sa connexion en lecture seule, sans formulaire", () => {
    h.raw = {
      status: "connected",
      version: "11.4.4-MariaDB-ubu2404",
      source: "file",
      fromEnv: false,
      pendingRestart: true,
      fields: { host: "mariadb", port: 3306, database: "tentacle", user: "tentacle" },
    };
    const out = html();
    expect(out).toContain("databaseDescriptionMariaDb");
    expect(out).toContain("mariadb");
    expect(out).toContain("3306");
    expect(out).toContain("MariaDB 11.4.4");
    expect(out).toContain("databasePending");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("databaseEngine");
  });
});
