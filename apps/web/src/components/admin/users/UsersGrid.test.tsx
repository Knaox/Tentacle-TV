import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Les états de la grille des comptes, rendus à plat : l'aperçu ne sait pas
 * provoquer un Jellyfin non configuré sans casser celui des autres. On prouve
 * ce qui s'affiche et ce qu'on peut faire dans chaque cas, pas le clic.
 *
 * `t()` rend la clé (suivie du compte quand il y en a un). Remplacés :
 * `adminUtils` (il importe `main.tsx`, donc toute l'app), `EmptyState` et
 * l'avatar (framer-motion et l'api-client tireraient une seconde copie de
 * React), `Link` (une ancre suffit).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}:${options.count}`),
    i18n: { language: "fr" },
  }),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));
vi.mock("../../../pages/adminUtils", () => ({ cls: { bp: "cta-primary", bs: "cta-secondary" } }));
vi.mock("../../ui/EmptyState", () => ({
  EmptyState: ({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) => (
    <div data-empty={title}>{description}{action}</div>
  ),
}));
vi.mock("../kit", async () => ({
  AdminNotice: (await import("../kit/AdminNotice")).AdminNotice,
  StatusPill: (await import("../kit/StatusPill")).StatusPill,
  UserAvatar: ({ name }: { name: string }) => <span data-avatar={name} />,
}));

const { UsersGrid } = await import("./UsersGrid");
type GridProps = Parameters<typeof UsersGrid>[0];

const noop = () => undefined;
const ALICE = { id: "a-1", name: "Alice", hasAvatar: true, imageTag: "t1", lastActivityDate: "2026-09-26T10:00:00Z", isAdministrator: true, isDisabled: false };
const BRUNO = { id: "b-2", name: "Bruno", hasAvatar: false, lastActivityDate: null, isAdministrator: false, isDisabled: true };

const render = (props: Partial<GridProps>) =>
  renderToStaticMarkup(
    <UsersGrid
      users={undefined}
      visible={[]}
      errorStatus={null}
      selfId={undefined}
      deviceCounts={null}
      now={Date.parse("2026-09-26T12:00:00Z")}
      onOpen={noop}
      onRetry={noop}
      onShowAll={noop}
      {...props}
    />,
  );

describe("la grille des comptes, avant d'avoir des comptes", () => {
  it("Jellyfin non configuré : un encadré annoncé, et Services comme seule issue — rien à retenter", () => {
    const html = render({ errorStatus: 503 });
    expect(html).toContain('role="alert"');
    expect(html).toContain("usersJellyfinMissing");
    expect(html).toContain('<a href="/admin/services" class="cta-primary">usersOpenServices</a>');
    expect(html).not.toContain(">retry<");
  });

  it("Jellyfin muet : retenter, ou aller vérifier dans Services", () => {
    const html = render({ errorStatus: 502 });
    expect(html).toContain("usersUnreachable");
    expect(html).toContain(">retry<");
    expect(html).toContain('<a href="/admin/services" class="cta-secondary">usersOpenServices</a>');
  });

  it("toute autre panne : retenter seulement", () => {
    const html = render({ errorStatus: 0 });
    expect(html).toContain("usersError");
    expect(html).toContain(">retry<");
    expect(html).not.toContain("/admin/services");
  });

  it("pendant le chargement : un squelette de huit cartes, masqué aux lecteurs d'écran", () => {
    const html = render({});
    expect(html).toMatch(/^<ul aria-hidden="true"/);
    expect(html.match(/<li /g)).toHaveLength(8);
  });
});

describe("la grille des comptes, une fois la liste arrivée", () => {
  it("un serveur sans compte le dit ; une recherche vaine propose de tout afficher", () => {
    expect(render({ users: [] })).toContain('data-empty="noUsers"');
    const html = render({ users: [ALICE], visible: [] });
    expect(html).toContain('data-empty="usersNoMatch"');
    expect(html).toContain(">usersShowAll</button>");
  });

  it("une carte par compte : photo, nom, rôle, état, « Vous », activité et appareils", () => {
    const html = render({
      users: [ALICE, BRUNO],
      visible: [ALICE, BRUNO],
      selfId: "A1",
      deviceCounts: new Map([["a1", [{}, {}]]]),
    });
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(html).toContain('data-avatar="Alice"');
    expect(html).toContain("userAdmin");
    expect(html).toContain("userYou");
    expect(html).toContain("userDisabled");
    // React écrit `dateTime` : la casse d'un attribut HTML ne compte pas.
    expect(html).toMatch(/datetime="2026-09-26T10:00:00Z"/i);
    expect(html).toContain("userDevices:2");
    expect(html).toContain("lastActivityNever");
  });

  it("appareils illisibles : aucune mention, plutôt qu'un « 0 appareil » faux", () => {
    const html = render({ users: [ALICE], visible: [ALICE], deviceCounts: null });
    expect(html).not.toContain("userDevices");
  });
});
