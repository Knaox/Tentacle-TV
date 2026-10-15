import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AccountFamilyRightsDto } from "@tentacle-tv/shared";
import { creationNote, familyPlace, isEditable } from "./familyRightsModel";

/**
 * La rubrique « Famille » de la fiche d'un compte : rien face à un serveur qui ne
 * déclare pas `family.creationRights` ; sinon les deux droits en groupes radio,
 * ce qui en vaut, sa place dans une famille et « Restreint par la famille de … ».
 */
const h = vi.hoisted(() => ({ capable: true, dto: null as AccountFamilyRightsDto | null }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key) }),
}));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: () => h.capable,
  useAccountFamilyRights: () => ({ data: h.dto, isError: false }),
  useSetAccountFamilyRights: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock("../../../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));

const { AccountFamilyRightsPanel } = await import("./AccountFamilyRightsPanel");

function dto(patch: Partial<AccountFamilyRightsDto> = {}): AccountFamilyRightsDto {
  return {
    userId: "hugo",
    rights: { createFamily: "inherit", createGuests: "deny" },
    defaults: { createFamily: false, createGuests: false },
    allowed: { createFamily: false, createGuests: false },
    isAdministrator: false,
    family: null,
    restrictedBy: null,
    ...patch,
  };
}

// Le rendu échappe les guillemets des valeurs interpolées : on compare sur le texte rendu.
const render = () => renderToStaticMarkup(<AccountFamilyRightsPanel userId="hugo" />).replace(/&quot;/g, '"');

beforeEach(() => {
  h.capable = true;
  h.dto = dto();
});

describe("AccountFamilyRightsPanel", () => {
  it("serveur qui ne déclare pas la capacité : rien", () => {
    h.capable = false;
    expect(render()).toBe("");
  });

  it("deux groupes radio, le réglage coché, le défaut rappelé, ce qui vaut dit", () => {
    const html = render();
    expect(html.match(/role="radiogroup"/g)).toHaveLength(2);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('accountRights.inherit{"value":"accountRights.no"}');
    expect(html).toContain("accountRights.denied");
    expect(html).not.toContain("accountRights.restrictedBy");
  });

  it("un membre mineur : sa famille, et « Restreint par la famille de … »", () => {
    h.dto = dto({ family: { role: "member", ownerName: "Damien", parent: false }, restrictedBy: { ownerName: "Damien" } });
    const html = render();
    expect(html).toContain('accountRights.member{"owner":"Damien"}');
    expect(html).toContain('accountRights.restrictedBy{"owner":"Damien"}');
  });

  it("un invité de la Famille : dit, sans aucun choix", () => {
    h.dto = dto({ family: { role: "guest", ownerName: "Damien", parent: false } });
    const html = render();
    expect(html).toContain("accountRights.guest");
    expect(html).not.toContain("radiogroup");
  });
});

describe("familyRightsModel", () => {
  it("un administrateur peut toujours ; un interrupteur coupé l'emporte sur un réglage permis", () => {
    expect(creationNote(dto({ isAdministrator: true, allowed: { createFamily: true, createGuests: true } }), "createGuests")).toBe("adminAlways");
    expect(creationNote(dto({ rights: { createFamily: "allow", createGuests: "deny" } }), "createFamily")).toBe("switchedOff");
    expect(creationNote(dto(), "createFamily")).toBeNull();
  });

  it("la place d'un parent ; un invité ne se règle pas", () => {
    expect(familyPlace(dto({ family: { role: "member", ownerName: "Damien", parent: true } }))).toEqual({ key: "parent", owner: "Damien" });
    expect(familyPlace(dto())).toBeNull();
    expect(isEditable(dto({ family: { role: "guest", ownerName: "Damien", parent: false } }))).toBe(false);
  });
});
