import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

// Rendu à plat, comme le kit : `Link` devient une ancre qui garde ses attributs.
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, replace: _replace, ...rest }: { to: string; replace?: boolean; children: ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { UsersTabs } = await import("./UsersTabs");

describe("les onglets d'« Utilisateurs »", () => {
  it("mènent aux comptes et aux invitations, chacun à son adresse", () => {
    const markup = renderToStaticMarkup(<UsersTabs active="users" />);
    expect(markup).toContain('href="/admin/users"');
    expect(markup).toContain('href="/admin/invites"');
    expect(markup).toContain('aria-label="usersTabsLabel"');
  });

  it("disent l'onglet courant par aria-current, sur lui seul", () => {
    const markup = renderToStaticMarkup(<UsersTabs active="invites" />);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/href="\/admin\/invites"[^>]*aria-current="page"/);
  });
});
