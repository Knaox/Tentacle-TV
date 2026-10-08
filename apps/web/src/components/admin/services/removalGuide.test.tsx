import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DatabaseMigrationSummary } from "./databaseMigrationApi";

/**
 * « MariaDB n'est plus nécessaire » : la marche à suivre, l'installation
 * détectée en premier onglet ; pour une base externe, la commande de
 * suppression à COPIER (jamais exécutée). Et la règle qui décide de la
 * recommandation : seulement une fois la copie du cache finie.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}));
vi.mock("../../../pages/adminUtils", () => ({ BACKEND: "", creds: () => "include", hdrs: () => ({}) }));
vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => true }));

const { RemovalGuide } = await import("./RemovalGuide");
const { migrationAttention, readDatabaseMigration } = await import("./databaseMigrationApi");

const summary = (kind: string, dropCommand: string | null = null): DatabaseMigrationSummary => ({
  legacy: "migrated",
  sourceConfigured: true,
  report: null,
  cache: { phase: "done", percent: 100 },
  sourceCheck: { status: "same" },
  removal: { kind, stack: null, dbService: "mariadb", database: "tentacle", containerized: true, dropCommand },
});

describe("la marche à suivre pour retirer MariaDB", () => {
  it("base externe : son onglet d'abord, la commande à copier, l'avertissement en tête", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("external", "DROP DATABASE `tentacle`;")} />);
    expect(out.indexOf("tab_external")).toBeLessThan(out.indexOf("tab_compose"));
    expect(out).toContain("guideWarning");
    expect(out).toContain("DROP DATABASE `tentacle`;");
  });

  it("service de la pile : Compose d'abord, le nom du service dans la phrase", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("compose-service")} />);
    expect(out).toContain('guide_compose{&quot;service&quot;:&quot;mariadb&quot;}');
    expect(out).not.toContain("DROP DATABASE");
  });
});

describe("la recommandation n'arrive qu'après la copie du cache", () => {
  it("copie en cours ou arrêtée : pas encore ; finie ou rien à copier : oui", () => {
    expect(migrationAttention({ ...summary("external"), cache: { phase: "running", percent: 40 } })?.cacheDone).toBe(false);
    expect(migrationAttention({ ...summary("external"), cache: { phase: "stopped", percent: 40 } })?.cacheDone).toBe(false);
    expect(migrationAttention(summary("external"))?.cacheDone).toBe(true);
    expect(migrationAttention({ ...summary("external"), cache: { phase: "none", percent: 0 } })?.cacheDone).toBe(true);
  });

  it("l'ancienne base qui a changé passe à la règle ; une lecture illisible ne fait rien tomber", () => {
    expect(migrationAttention({ ...summary("external"), sourceCheck: { status: "changed", why: "identity" } })?.sourceChanged).toBe("identity");
    expect(migrationAttention(null)).toBeNull();
    expect(readDatabaseMigration({ legacy: "nonsense" })).toBeNull();
    expect(readDatabaseMigration("x")).toBeNull();
  });
});
