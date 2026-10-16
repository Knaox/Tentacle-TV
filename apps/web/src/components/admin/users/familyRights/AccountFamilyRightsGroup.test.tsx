import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AccountFamilyRightsDto } from "@tentacle-tv/shared";
import { creationNote, familyPlace, familyRightsSummary, isEditable } from "./familyRightsModel";

/**
 * La rubrique « Famille » de la fiche des droits d'un compte : rien face à un serveur qui
 * ne déclare pas `family.creationRights` ; sinon une rubrique repliable comme les autres,
 * résumée en une ligne (ce qui vaut, « restreint par la famille de … »), et, ouverte, les
 * deux droits en boutons radio expliqués.
 */
const h = vi.hoisted(() => ({ capable: true, dto: null as AccountFamilyRightsDto | null, open: false }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  // La rubrique se rend ouverte ou fermée selon le banc (l'état local naît de `useState`).
  return { ...actual, useState: (initial: unknown) => actual.useState(typeof initial === "boolean" ? h.open : initial) };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key) }),
}));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: () => h.capable,
  useAccountFamilyRights: () => ({ data: h.dto, isError: false }),
  useSetAccountFamilyRights: () => ({ mutate: () => undefined, isPending: false }),
}));

const { AccountFamilyRightsGroup } = await import("./AccountFamilyRightsGroup");

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
const render = () => renderToStaticMarkup(<AccountFamilyRightsGroup userId="hugo" />).replace(/&quot;/g, '"');

beforeEach(() => {
  h.capable = true;
  h.dto = dto();
  h.open = false;
});

describe("AccountFamilyRightsGroup", () => {
  it("serveur qui ne déclare pas la capacité : rien", () => {
    h.capable = false;
    expect(render()).toBe("");
  });

  it("fermée : une rubrique comme les autres, résumée en une ligne, rien de monté dessous", () => {
    const html = render();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("accountRights.title");
    expect(html).toContain('accountRights.summaryFamily{"value":"accountRights.summaryDenied"}');
    expect(html).not.toContain('type="radio"');
  });

  it("ouverte : deux droits en boutons radio expliqués, le réglage coché, le défaut rappelé", () => {
    h.open = true;
    const html = render();
    expect(html.match(/<fieldset/g)).toHaveLength(2);
    expect(html.match(/type="radio"/g)).toHaveLength(6);
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toContain('accountRights.inherit{"value":"accountRights.no"}');
    expect(html).toContain('accountRights.inheritDetail{"value":"accountRights.no"}');
  });

  it("un membre mineur : sa famille, et « Restreint par la famille de … », jusque dans le résumé", () => {
    h.open = true;
    h.dto = dto({ family: { role: "member", ownerName: "Damien", parent: false }, restrictedBy: { ownerName: "Damien" } });
    const html = render();
    expect(html).toContain('accountRights.member{"owner":"Damien"}');
    expect(html).toContain('accountRights.restrictedBy{"owner":"Damien"}');
    expect(html).toContain('accountRights.summaryRestricted{"owner":"Damien"}');
  });

  it("un invité de la Famille : dit, sans aucun choix", () => {
    h.open = true;
    h.dto = dto({ family: { role: "guest", ownerName: "Damien", parent: false } });
    const html = render();
    expect(html).toContain('accountRights.summaryGuest{"owner":"Damien"}');
    expect(html).not.toContain('type="radio"');
  });
});

describe("« Autoriser ses invités à demander des films » (1.30.0)", () => {
  it("montré avec une extension qui sait demander : trois droits, et le résumé le dit", () => {
    h.open = true;
    h.dto = dto({
      requestExtension: true,
      rights: { createFamily: "inherit", createGuests: "deny", grantGuestRequests: "allow" },
      allowed: { createFamily: false, createGuests: false, grantGuestRequests: true },
    });
    const html = render();
    expect(html).toContain("accountRights.grantGuestRequests");
    expect(html.match(/type="radio"/g)).toHaveLength(9);
    expect(familyRightsSummary(h.dto, true).map((part) => part.key)).toContain("summaryGuestRequests");
  });

  it("sans extension, ou face à un serveur d'avant : deux droits, comme alors", () => {
    h.open = true;
    expect(render().match(/type="radio"/g)).toHaveLength(6);
    expect(familyRightsSummary(dto({ requestExtension: false }), true).map((part) => part.key)).not.toContain("summaryGuestRequests");
  });

  it("l'interrupteur coupé l'emporte sur un compte permis : dit par sa propre note", () => {
    const off = dto({
      requestExtension: true,
      rights: { createFamily: "inherit", createGuests: "inherit", grantGuestRequests: "allow" },
      allowed: { createFamily: false, createGuests: false, grantGuestRequests: false },
    });
    expect(creationNote(off, "grantGuestRequests")).toBe("switchedOffRequests");
    expect(creationNote(dto({ isAdministrator: true, allowed: { createFamily: true, createGuests: true, grantGuestRequests: true } }), "grantGuestRequests")).toBe("adminAlways");
  });
});

describe("familyRightsModel", () => {
  it("un administrateur peut toujours ; un interrupteur coupé l'emporte sur un réglage permis", () => {
    expect(creationNote(dto({ isAdministrator: true, allowed: { createFamily: true, createGuests: true } }), "createGuests")).toBe("adminAlways");
    expect(creationNote(dto({ rights: { createFamily: "allow", createGuests: "deny" } }), "createFamily")).toBe("switchedOff");
    expect(creationNote(dto(), "createFamily")).toBeNull();
  });

  it("la place d'un parent ; un invité ne se règle pas ; le résumé dit ce qui vaut", () => {
    expect(familyPlace(dto({ family: { role: "member", ownerName: "Damien", parent: true } }))).toEqual({ key: "parent", owner: "Damien" });
    expect(familyPlace(dto())).toBeNull();
    expect(isEditable(dto({ family: { role: "guest", ownerName: "Damien", parent: false } }))).toBe(false);
    expect(familyRightsSummary(dto({ allowed: { createFamily: true, createGuests: false } })).map((part) => part.valueKey)).toEqual([
      "summaryAllowed",
      "summaryDenied",
    ]);
  });
});
