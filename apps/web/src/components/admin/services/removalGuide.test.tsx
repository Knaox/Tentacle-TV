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
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key),
    i18n: { language: "fr-FR" },
  }),
}));
vi.mock("../../../pages/adminUtils", () => ({ BACKEND: "", creds: () => "include", hdrs: () => ({}) }));
vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => true }));

const { RemovalGuide } = await import("./RemovalGuide");
const { GuideSteps } = await import("./GuideSteps");
const { migrationAttention, readDatabaseMigration } = await import("./databaseMigrationApi");

const summary = (kind: string, dropCommand: string | null = null, extra: Partial<DatabaseMigrationSummary["removal"]> = {}): DatabaseMigrationSummary => ({
  legacy: "migrated",
  sourceConfigured: true,
  report: null,
  cache: { phase: "done", percent: 100 },
  sourceCheck: { status: "same" },
  removal: { kind, stack: null, dbService: "mariadb", database: "tentacle", containerized: true, dropCommand, ...extra },
});

describe("la marche à suivre pour retirer MariaDB", () => {
  it("base externe : son onglet d'abord, la commande à copier, l'avertissement en tête", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("external", "DROP DATABASE `tentacle`;")} />);
    expect(out.indexOf("tab_external")).toBeLessThan(out.indexOf("tab_compose"));
    expect(out).toContain("guideWarning");
    expect(out).toContain("DROP DATABASE `tentacle`;");
  });

  it("la commande est celle du SERVEUR, échappée par lui (backtick doublé) ; le web n'en construit jamais", () => {
    const named = { ...summary("external", "DROP DATABASE `ma``base`;"), removal: { ...summary("external").removal, database: "ma`base", dropCommand: "DROP DATABASE `ma``base`;" } };
    expect(renderToStaticMarkup(<RemovalGuide summary={named} />)).toContain("DROP DATABASE `ma``base`;");
    const without = { ...summary("external"), removal: { ...summary("external").removal, database: "ma`base", dropCommand: null } };
    const out = renderToStaticMarkup(<RemovalGuide summary={without} />);
    expect(out).not.toContain("DROP DATABASE");
  });

  it("pile officielle d'avant : son onglet d'abord, les deux voies, et la commande de SA remplaçante seulement", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("official-stack", null, { stack: "full", newStack: "tentacle-full", dbService: "db" })} />);
    expect(out.indexOf("tab_officialStack")).toBeLessThan(out.indexOf("tab_compose"));
    expect(out).toContain("switchTitle");
    expect(out).toContain("curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml");
    expect(out).not.toContain("stacks/tentacle-only/compose.yaml");
    expect(out).toContain("linesTitle");
    expect(out).toContain('guide_officialStack{&quot;service&quot;:&quot;db&quot;}');
    expect(out).toContain('guide_officialStack_after{&quot;service&quot;:&quot;db&quot;}');
  });

  it("un serveur qui ne dit pas la remplaçante : les deux piles d'aujourd'hui, et rien d'inventé", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("official-stack", null, { newStack: "tentacle-db" })} />);
    expect(out).toContain("switchIntroBoth");
    expect(out).toContain("stacks/tentacle-full/compose.yaml");
    expect(out).toContain("stacks/tentacle-only/compose.yaml");
    expect(out).not.toContain("stacks/tentacle-db");
  });

  it("source dans le fichier de l'ancien assistant : la commande du serveur pour le supprimer, en tête", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("external", "DROP DATABASE `tentacle`;", { forgetCommand: "rm /app/apps/backend/data/database.json" })} />);
    expect(out).toContain("forgetTitle");
    expect(out).toContain("forgetBody_container");
    expect(out.indexOf("rm /app/apps/backend/data/database.json")).toBeLessThan(out.indexOf("tab_external"));
    expect(renderToStaticMarkup(<RemovalGuide summary={summary("external")} />)).not.toContain("forgetTitle");
  });

  it("le guide complet : la page du site, dans la langue de l'interface", () => {
    const out = renderToStaticMarkup(<RemovalGuide summary={summary("unknown")} />);
    expect(out).toContain('href="https://tentacletv.app/docs/server/sqlite-migration/?lang=fr"');
  });

  it("une étape par ligne du texte, les lignes vides ignorées", () => {
    const out = renderToStaticMarkup(<GuideSteps text={"Supprimez le service.\nAppliquez.\n"} />);
    expect(out.match(/<li>/g)).toHaveLength(2);
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
