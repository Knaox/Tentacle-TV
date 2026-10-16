import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FamilyErrorCode, FamilyOverviewDto } from "@tentacle-tv/shared";

/**
 * Réglages › Famille depuis la session d'un PROFIL du bureau (1.30.0,
 * `family.profileManage`) : la page n'existe que si le serveur sait faire gérer
 * un profil, et jamais pour un invité ; ensuite, c'est le serveur qui dit ce
 * qui manque — SON code (`manage_pin_required`), le déverrouillage
 * (`manage_locked`) — ou rend la famille, gérée avec les droits du profil.
 * Un serveur qui ne déclare rien : aucune trace, aucune erreur.
 */
const h = vi.hoisted(() => ({
  capability: true,
  profile: { id: "lea", kind: "member" } as null | { id: string; kind: "owner" | "member" | "guest" },
  refusal: null as null | FamilyErrorCode,
  data: undefined as FamilyOverviewDto | undefined,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }));
vi.mock("react-router-dom", () => ({ Navigate: ({ to }: { to: string }) => <a data-navigate={to} /> }));
vi.mock("@tentacle-tv/ui", () => ({ Shimmer: () => <span /> }));
vi.mock("@tentacle-tv/api-client", () => ({
  useAppConfig: () => ({ data: { features: { family: { v: 2, enabled: true, guests: true } } }, isPending: false }),
  useServerCapability: (key: string) => key === "family.profileManage" && h.capability,
  useFamilyOverview: (options: { enabled?: boolean }) =>
    options.enabled === false
      ? { data: undefined, isError: false }
      : { data: h.data, isError: h.refusal !== null, error: h.refusal, refetch: () => undefined },
  familyErrorFromApi: (error: unknown) => (error ? { code: error, message: "" } : null),
  useUnlockFamilyManage: () => ({ mutate: () => undefined, isPending: false, isError: false }),
}));
vi.mock("../../offline/useOfflineMode", () => ({ useOfflineMode: () => false }));
vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => h.profile }));
vi.mock("../../components/PageTransition", () => ({ PageTransition: ({ children }: { children: unknown }) => <main>{children as never}</main> }));
vi.mock("../../family/useFamilyText", () => ({ useFamilyText: () => ({ errorText: () => "", codeText: () => "" }) }));
vi.mock("../../family/page/AccountSections", () => ({ DissolveSection: () => <i data-section="dissolve" />, MyPinSection: () => <i data-section="my-pin" /> }));
vi.mock("../../family/page/FamilySection", () => ({ FamilySection: () => <i data-section="family" /> }));
vi.mock("../../family/page/IncomingInvitations", () => ({ IncomingInvitationsSection: () => <i data-section="incoming" /> }));
vi.mock("../../family/page/LeaveSection", () => ({ LeaveSection: () => <i data-section="leave" /> }));
vi.mock("../../family/pinSuggest/FamilyPinCard", () => ({ FamilyPinCard: () => null }));
vi.mock("../../profiles/settings/AskAtLaunchSection", () => ({ AskAtLaunchSection: () => <i data-section="ask" /> }));

const { SettingsFamily } = await import("./SettingsFamily");

function managed(): FamilyOverviewDto {
  return {
    v: 2,
    switches: { families: true, guests: true },
    account: { canOwn: false, canJoin: false, reviewAccount: false, hasPin: true, personalSession: false, managing: true },
    family: {
      id: "f", role: "member", parent: true, owner: { userId: "owner", name: "Damien" }, profiles: [], pendingInvitations: [],
      rights: { manageMembers: false, createGuests: true, manageGuests: "all", manageRoles: false, manageMinors: true },
      createdAt: "2026-10-01T00:00:00Z", since: null,
    },
    owned: null,
    memberships: [],
    incoming: [],
    limits: { maxProfiles: 6, maxGuests: 3 },
  };
}

const render = () => renderToStaticMarkup(<SettingsFamily />);

beforeEach(() => {
  h.capability = true;
  h.profile = { id: "lea", kind: "member" };
  h.refusal = null;
  h.data = undefined;
});

describe("Réglages › Famille depuis la session d'un profil du bureau", () => {
  it("serveur qui ne déclare pas `family.profileManage` : la page n'existe pas, comme avant", () => {
    h.capability = false;
    expect(render()).toContain('data-navigate="/settings"');
  });

  it("un invité ne gère jamais rien : la page n'existe pas", () => {
    h.profile = { id: "zoe", kind: "guest" };
    expect(render()).toContain('data-navigate="/settings"');
  });

  it("sans code PIN : le serveur le dit, la page le répète — aucun geste", () => {
    h.refusal = "family.manage_pin_required";
    const html = render();
    expect(html).toContain("errors.manage_pin_required");
    expect(html).not.toContain('data-section="family"');
  });

  it("gestion fermée : SON code la rouvre, rien d'autre ne s'affiche", () => {
    h.refusal = "family.manage_locked";
    const html = render();
    expect(html).toContain("manageUnlock.title");
    expect(html).toContain('type="password"');
    expect(html).not.toContain('data-section="family"');
  });

  it("gestion ouverte : la famille, gérée avec les droits du profil — jamais un geste personnel", () => {
    h.data = managed();
    const html = render();
    expect(html).toContain('data-section="family"');
    expect(html).toContain("notice.profileManage");
    for (const personal of ["leave", "dissolve", "my-pin", "ask", "incoming"]) expect(html).not.toContain(`data-section="${personal}"`);
  });
});
