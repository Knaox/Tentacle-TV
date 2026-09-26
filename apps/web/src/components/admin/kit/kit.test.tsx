import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";

/**
 * Le kit rendu à plat, comme les autres bancs de composants : on prouve les
 * rôles, les attributs ARIA et les classes qui portent le sens, pas le clic.
 * Les fichiers sont importés un à un — le barillet tire `UserAvatar`, donc
 * l'api-client. `Link` devient une ancre et l'entrée animée un simple bloc :
 * chargés en vrai, react-router et framer-motion tirent une seconde copie de
 * React et le rendu échoue.
 */

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));
vi.mock("../../PageTransition", () => ({
  PageTransition: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

const { Tabs, TabPanel } = await import("../../ui/Tabs");
const { AdminPage, AdminPageHeader } = await import("./AdminPage");
const { AdminSection } = await import("./AdminSection");
const { StatTile } = await import("./StatTile");
const { StatusPill } = await import("./StatusPill");

const html = (node: ReactElement) => renderToStaticMarkup(node);
const noop = () => undefined;

const ITEMS = [
  { id: "installed", label: "Installés", count: 4 },
  { id: "marketplace", label: "Marketplace" },
  { id: "sources", label: "Sources", count: 2 },
] as const;

describe("les onglets accessibles", () => {
  const markup = html(<Tabs idPrefix="p" label="Plugins" items={ITEMS} active="marketplace" onChange={noop} />);

  it("une liste d'onglets nommée", () => {
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Plugins"');
    expect(markup.match(/role="tab"/g)).toHaveLength(3);
  });

  it("seul l'onglet actif est dans l'ordre de tabulation, et lui seul désigne son panneau", () => {
    expect(markup).toMatch(/id="p-tab-marketplace"[^>]*aria-selected="true"[^>]*aria-controls="p-panel-marketplace"[^>]*tabindex="0"/);
    expect(markup).toMatch(/id="p-tab-installed"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
    expect(markup).not.toContain('aria-controls="p-panel-installed"');
  });

  it("les compteurs accompagnent leur libellé", () => {
    expect(markup).toMatch(/Installés<span[^>]*>4<\/span>/);
    expect(markup).toMatch(/Sources<span[^>]*>2<\/span>/);
  });

  it("le panneau actif est relié à son onglet, les autres ne sont pas montés", () => {
    const active = html(<TabPanel idPrefix="p" id="sources" active>contenu</TabPanel>);
    expect(active).toContain('role="tabpanel"');
    expect(active).toContain('id="p-panel-sources"');
    expect(active).toContain('aria-labelledby="p-tab-sources"');
    expect(html(<TabPanel idPrefix="p" id="sources" active={false}>contenu</TabPanel>)).toBe("");
  });
});

describe("l'en-tête d'une page d'administration", () => {
  it("un h1 au titre, la description, les actions", () => {
    const markup = html(
      <AdminPageHeader title="Utilisateurs" description="Les comptes du serveur." actions={<button>Inviter</button>} />,
    );
    expect(markup).toMatch(/<h1[^>]*>Utilisateurs<\/h1>/);
    expect(markup).toContain("Les comptes du serveur.");
    expect(markup).toContain("<button>Inviter</button>");
  });

  it("la page pose l'en-tête puis son contenu, sans marges ni largeur à elle", () => {
    const markup = html(<AdminPage title="Services" summary={<p>résumé</p>}>corps</AdminPage>);
    expect(markup).toMatch(/<h1[^>]*>Services<\/h1>/);
    expect(markup.indexOf("résumé")).toBeLessThan(markup.indexOf("corps"));
    expect(markup).not.toMatch(/max-w-(?:4xl|6xl)|md:px-12/);
  });
});

describe("la carte de section", () => {
  it("son titre est un h2 qui la nomme", () => {
    const markup = html(<AdminSection title="Jellyfin" id="jellyfin">corps</AdminSection>);
    const headingId = markup.match(/<h2 id="([^"]+)"/)?.[1];
    expect(headingId).toBeTruthy();
    expect(markup).toContain(`aria-labelledby="${headingId}"`);
    expect(markup).toContain('id="jellyfin"');
  });

  it("ne rogne son contenu qu'en mode bord à bord — un menu déroulant y survit", () => {
    expect(html(<AdminSection title="A">x</AdminSection>)).not.toContain("overflow-hidden");
    expect(html(<AdminSection title="A" flush>x</AdminSection>)).toContain("overflow-hidden");
  });

  it("la zone destructive est bordée de rouge", () => {
    expect(html(<AdminSection title="Réinitialiser" tone="danger">x</AdminSection>)).toContain("border-danger-border");
  });
});

describe("la tuile de chiffre", () => {
  it("avec une destination, la tuile entière est le lien", () => {
    const markup = html(<StatTile label="Tickets ouverts" value={3} to="/admin/tickets" />);
    expect(markup).toMatch(/^<a [^>]*href="\/admin\/tickets"/);
    expect(markup).toContain(">3</p>");
  });

  it("en chargement : un squelette, occupé, sans valeur", () => {
    const markup = html(<StatTile label="Comptes" value={12} loading />);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("skeleton-shimmer");
    expect(markup).not.toContain(">12<");
  });

  it("sans valeur : un tiret", () => {
    expect(html(<StatTile label="Plugins" value={null} />)).toContain(">—</p>");
  });
});

describe("la puce d'état", () => {
  it("porte les jetons de son statut", () => {
    const markup = html(<StatusPill tone="success">Connecté</StatusPill>);
    expect(markup).toContain("bg-status-success-bg");
    expect(markup).toContain("text-status-success-fg");
    expect(markup).toContain("Connecté");
  });

  it("sans point quand on le demande", () => {
    expect(html(<StatusPill tone="neutral" dot={false}>v10.10</StatusPill>)).not.toContain('aria-hidden="true"');
  });
});
