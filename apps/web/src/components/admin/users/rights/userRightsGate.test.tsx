import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { PLAIN_RIGHTS } from "./rightsFixture";

/**
 * La fiche d'un compte face aux deux serveurs : celui qui déclare
 * `admin.userRights` reçoit toutes les rubriques, résumées ; celui qui ne
 * déclare rien garde la section « Téléchargements » d'avant, sans qu'aucune
 * route des droits ne soit seulement appelée. Rendu à plat : `t()` rend la clé.
 */
const h = vi.hoisted(() => ({
  capability: false,
  rightsCalls: 0,
  rights: { data: undefined as unknown, isPending: false, error: null as unknown },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: () => h.capability,
  useUserRights: () => {
    h.rightsCalls += 1;
    return { ...h.rights, refetch: () => undefined };
  },
  useUserRightsOptions: () => ({ data: { libraries: [], parentalRatings: [], unratedItemTypes: [], knownTags: [] }, isError: false }),
  useUpdateUserRights: () => ({ mutateAsync: async () => undefined }),
  userRightsRefusalOf: (error: unknown) => (error as { code?: string } | null)?.code ? { error: (error as { code: string }).code } : null,
  // La rubrique « Famille » (S4, `family.creationRights`), montée après « Gestion ».
  useAccountFamilyRights: () => ({ data: undefined, isError: false }),
  useSetAccountFamilyRights: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock("../../../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../../../../hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../../../ui/Sheet", () => ({ Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null) }));
vi.mock("../../../ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("../../kit", () => ({ UserAvatar: () => <span /> }));
vi.mock("../UserBadges", () => ({ UserBadges: () => null }));
vi.mock("../UserDevicesSection", () => ({ UserDevicesSection: () => null }));
vi.mock("../UserImpersonation", () => ({ UserImpersonation: () => null }));
vi.mock("../UserRightsSection", () => ({ UserRightsSection: () => <section data-old-rights /> }));

const { UserSheet } = await import("../UserSheet");

const USER = { id: "u-1", name: "Léa", hasAvatar: false, lastActivityDate: null, isAdministrator: false, isDisabled: false };
const render = () =>
  renderToStaticMarkup(
    <UserSheet user={USER} isSelf={false} devices={[]} devicesFailed={false} now={0} onClose={() => undefined} />,
  );

beforeEach(() => {
  h.capability = false;
  h.rightsCalls = 0;
  h.rights = { data: undefined, isPending: false, error: null };
});

describe("la fiche des droits d'un compte", () => {
  it("serveur qui ne déclare rien : la section d'avant, et aucune route des droits appelée", () => {
    const html = render();
    expect(html).toContain("data-old-rights");
    expect(html).not.toContain("sectionTitle");
    expect(h.rightsCalls).toBe(0);
  });

  it("serveur qui déclare la capacité : six rubriques repliées, chacune résumée, puis la Famille", () => {
    h.capability = true;
    h.rights = { data: { userId: "u-1", name: "Léa", rights: PLAIN_RIGHTS, readAt: "2026-10-15T10:00:00Z" }, isPending: false, error: null };
    const html = render();
    expect(html).not.toContain("data-old-rights");
    for (const group of ["account", "libraries", "parental", "playback", "offline", "management"]) {
      expect(html).toContain(`groups.${group}`);
    }
    expect(html).toContain("summary.noParental");
    expect(html).toContain("accountRights.title");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(7);
  });

  it("un refus du serveur à la lecture est dit en mots, avec « Réessayer »", () => {
    h.capability = true;
    h.rights = { data: undefined, isPending: false, error: { code: "family_guest" } };
    const html = render();
    expect(html).toContain("refusal.family_guest");
    expect(html).toContain("retry");
  });
});
