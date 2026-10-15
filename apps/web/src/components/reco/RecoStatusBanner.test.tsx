import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { i18n, initI18n } from "@tentacle-tv/shared";
import type { RecoPage } from "@tentacle-tv/api-client";

/**
 * « Pour vous » sur un serveur sans clé TMDB : la page dit que les
 * recommandations ne sont pas activées — avant même le réglage du compte, qui
 * n'y changerait rien — et seul un administrateur en session personnelle
 * reçoit le bouton, qui mène au champ de la clé (la cible du tableau de bord).
 * Un serveur qui n'en dit rien (`tmdbConfigured` absent) : comme avant.
 */

const state = vi.hoisted(() => ({ admin: false, profile: null as unknown }));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: (ns: string | string[]) => ({ t: i18n.getFixedT(null, ns), i18n }),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));
vi.mock("../userMenu/menuItems", () => ({ getUserInfo: () => ({ name: "", initial: "?", isAdmin: state.admin }) }));
vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => state.profile }));

const { RecoStatusBanner } = await import("./RecoStatusBanner");
const { ENTRY_ACTION } = await import("../admin/attention/attentionCopy");

function page(over: Partial<RecoPage>): RecoPage {
  return { state: "disabled", personalized: true, tmdbConfigured: false, rows: [], signalCount: 0, generating: false, refining: false, ...over } as RecoPage;
}

/** Une phrase telle que le rendu statique l'écrit (apostrophes échappées). */
function text(key: string): string {
  return i18n.t(key).replace(/'/g, "&#x27;");
}

function render(p: RecoPage): string {
  return renderToStaticMarkup(<RecoStatusBanner page={p} hasPersonalizedRows={false} onOpenColdStart={() => undefined} />);
}

beforeAll(async () => {
  await initI18n({ lng: "fr" });
});
beforeEach(() => {
  state.admin = false;
  state.profile = null;
});

describe("RecoStatusBanner sans clé TMDB", () => {
  it("dit que les recommandations ne sont pas activées, sans bouton pour un membre", () => {
    const html = render(page({}));
    expect(html).toContain(text("reco:tmdbOffText"));
    expect(html).toContain(text("reco:tmdbOffMemberHint"));
    expect(html).not.toContain("href=");
    expect(html).not.toContain('role="alert"');
  });

  it("offre à l'administrateur le champ de la clé — la cible du tableau de bord", () => {
    state.admin = true;
    const html = render(page({}));
    expect(html).toContain(text("reco:tmdbOffAdminHint"));
    const target = ENTRY_ACTION.tmdbKey.kind === "link" ? ENTRY_ACTION.tmdbKey.to : "";
    expect(target).toBe("/admin/metadata#tmdb");
    expect(html).toContain(`href="${target}"`);
    expect(html).toContain(text("reco:tmdbOffCta"));
  });

  it("ne l'offre pas depuis une session de profil, même d'un administrateur", () => {
    state.admin = true;
    state.profile = { kind: "member" };
    expect(render(page({}))).not.toContain("href=");
  });

  it("prime sur la perso coupée par le compte : sans clé, ce réglage n'y peut rien", () => {
    const html = render(page({ personalized: false }));
    expect(html).toContain(text("reco:tmdbOffText"));
    expect(html).not.toContain("/settings/personalization");
  });

  it("serveur avec clé, ou qui n'en dit rien : aucun mot de TMDB", () => {
    expect(render(page({ tmdbConfigured: true, state: "ready" }))).toBe("");
    expect(render(page({ tmdbConfigured: undefined, state: "ready" }))).toBe("");
  });
});
