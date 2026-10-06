import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SetupHostInfo } from "@tentacle-tv/shared";

/**
 * « Où trouver le code ? » : un onglet par façon de lire le journal, le plus
 * probable ouvert d'abord, et des commandes qui visent l'IDENTIFIANT du
 * conteneur — jamais un nom de service supposé. `t()` rend la clé et ses
 * paramètres.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key === "codeHelp_containerPlaceholder" ? "<conteneur>" : opts ? `${key}${JSON.stringify(opts)}` : key,
  }),
}));

const { CodeHelp } = await import("./CodeHelp");
const { CodeHelpPanel } = await import("./CodeHelpPanels");
const { codeHelpCommands, codeHelpTabs, initialCodeHelpTab } = await import("./codeHelpModel");

const ID = "3f9c2a7b1d4e";
const docker = (over: Partial<SetupHostInfo> = {}): SetupHostInfo => ({ deployment: "docker", stack: "full", containerized: true, containerId: ID, ...over });
const decode = (html: string) => html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const panel = (tab: Parameters<typeof CodeHelpPanel>[0]["tab"], containerId: string | null = ID) =>
  decode(renderToStaticMarkup(<CodeHelpPanel tab={tab} commands={codeHelpCommands(containerId, "<conteneur>")} containerId={containerId} />));

describe("le choix des onglets", () => {
  it("conteneur à l'identifiant connu : la ligne de commande d'abord", () => {
    expect(codeHelpTabs(docker())).toEqual(["docker", "portainer", "compose", "nas"]);
    expect(initialCodeHelpTab(docker())).toBe("docker");
  });

  it("identifiant illisible, ou serveur muet : Compose d'abord ; muet, tous les chemins", () => {
    expect(initialCodeHelpTab(docker({ containerId: null }))).toBe("compose");
    expect(initialCodeHelpTab(null)).toBe("compose");
    expect(codeHelpTabs(null)).toContain("native");
  });

  it("hors conteneur : l'installation native seule", () => {
    const native: SetupHostInfo = { deployment: "native", stack: null, containerized: false, containerId: null };
    expect(codeHelpTabs(native)).toEqual(["native"]);
    expect(initialCodeHelpTab(native)).toBe("native");
  });
});

describe("l'écran rendu", () => {
  it("l'identifiant du conteneur est affiché, et l'onglet ouvert vise cet identifiant", () => {
    const out = decode(renderToStaticMarkup(<CodeHelp host={docker()} defaultOpen />));
    expect(out).toContain(`>${ID}</code>`);
    expect(out).toContain('aria-selected="true"');
    expect(out).toMatch(/aria-selected="true"[^>]*>codeHelp_tab_docker/);
    expect(out).toContain(`docker logs ${ID}`);
    expect(out).toContain("<details open");
    expect(out).not.toContain("docker compose");
  });

  it("code repris du lien : l'aide reste repliée", () => {
    expect(renderToStaticMarkup(<CodeHelp host={docker()} defaultOpen={false} />)).not.toContain("<details open");
  });

  it("ligne de commande : journal et code neuf par l'identifiant, Podman cité", () => {
    const out = panel("docker");
    expect(out).toContain(`docker logs ${ID}`);
    expect(out).toContain(`docker exec ${ID} tentacle setup token`);
    expect(out).toContain("codeHelp_dockerIdKnown");
    expect(out).toContain("codeHelp_podman");
  });

  it("ligne de commande sans identifiant : un repère à remplacer, expliqué", () => {
    const out = panel("docker", null);
    expect(out).toContain("docker logs <conteneur>");
    expect(out).toContain("codeHelp_dockerIdUnknown");
  });

  it("Portainer : les étapes, le conteneur reconnu à son identifiant, la console", () => {
    const out = panel("portainer");
    expect(out.match(/<li>/g)).toHaveLength(3);
    expect(out).toContain(`codeHelp_pickContainerId{"id":"${ID}"}`);
    expect(out).toContain("codeHelp_portainerConsole");
    expect(out).toContain("<code>tentacle setup token</code>");
  });

  it("Compose : le service des piles officielles, en disant de le remplacer", () => {
    const out = panel("compose");
    expect(out).toContain("docker compose logs tentacle");
    expect(out).toContain("docker compose exec tentacle tentacle setup token");
    expect(out).toContain('codeHelp_composeService{"service":"tentacle"}');
  });

  it("Synology, Unraid… : journal ou terminal du conteneur, puis la commande", () => {
    const out = panel("nas", null);
    expect(out).toContain("codeHelp_pickContainer<");
    expect(out).toContain("codeHelp_nasExamples");
    expect(out).toContain("<code>tentacle setup token</code>");
  });

  it("sans Docker : la commande native", () => {
    expect(panel("native", null)).toContain("node apps/backend/dist/cli/tentacle.js setup token");
  });
});
