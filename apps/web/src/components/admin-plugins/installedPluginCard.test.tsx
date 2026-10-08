import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InstalledPluginCard } from "./InstalledPluginCard";
import { statePill } from "./cardState";
import type { InstalledPlugin } from "./types";

/**
 * La carte d'une extension installée : l'interrupteur dit ce que VEUT
 * l'admin, la pastille ce qui TOURNE. Une extension activée que ce serveur
 * refuse (base SQLite non déclarée) montre « À mettre à jour » et l'encadré
 * « Arrêtée », jamais « Actif » — l'interrupteur, lui, reste allumé.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr", resolvedLanguage: "fr" } }),
}));

function plugin(overrides: Partial<InstalledPlugin> = {}): InstalledPlugin {
  return {
    id: "11111111-1111-4111-8111-111111111111", pluginId: "seer", sourceId: "official", name: "Vigie",
    version: "1.24.1", enabled: true, config: {}, installedAt: "2026-10-08T00:00:00.000Z",
    ...overrides,
  } as InstalledPlugin;
}

function render(p: InstalledPlugin): string {
  // Sans « Configurer » (configureTo nul), la carte ne rend aucun lien : pas de routeur.
  return renderToStaticMarkup(
    <InstalledPluginCard
      plugin={p} entry={undefined} source={undefined} update={null} configureTo={null}
      state={undefined} locked={false} restarting={false}
      onToggle={() => {}} onUpdate={() => {}} onUninstall={() => {}}
    />,
  );
}

describe("l'état en tête de carte", () => {
  it("activée et refusée : « À mettre à jour », pas « Actif »", () => {
    expect(statePill(true, true)).toEqual({ tone: "warning", label: "stateNeedsUpdate" });
    expect(statePill(true, false)).toEqual({ tone: "success", label: "stateEnabled" });
    expect(statePill(false, true)).toEqual({ tone: "neutral", label: "stateDisabled" });
  });

  it("la carte d'une extension refusée : « À mettre à jour », l'encadré, l'interrupteur allumé", () => {
    const html = render(plugin({ serverModule: { state: "failed", refusal: "sqliteUnsupported" } }));
    expect(html).toContain("stateNeedsUpdate");
    expect(html).not.toContain("stateEnabled");
    expect(html).toContain("storageRefusedTitle");
    // Pas de pastille « module en échec » en plus de l'encadré.
    expect(html).not.toContain("serverModuleFailed");
    expect(html).toMatch(/aria-checked="true"/);
  });

  it("une extension qui tourne reste « Actif »", () => {
    const html = render(plugin({ serverModule: { state: "running" } }));
    expect(html).toContain("stateEnabled");
    expect(html).not.toContain("stateNeedsUpdate");
    expect(html).not.toContain("storageRefusedTitle");
  });
});
