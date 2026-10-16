import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FamilyCreationDefaults, FamilySwitches } from "@tentacle-tv/shared";

/**
 * Admin › Utilisateurs › Familles : face à un serveur `family.creationRights`,
 * UNE rangée par fonction en trois positions — plus les quatre bascules dont
 * deux semblaient répéter les deux autres. Serveur d'avant : les deux
 * interrupteurs seuls.
 */
const h = vi.hoisted(() => ({
  capable: true,
  switches: { families: true, guests: true } as FamilySwitches,
  defaults: { createFamily: false, createGuests: true } as FamilyCreationDefaults | undefined,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../family/useFamilyAvailability", () => ({ useFamilyAvailability: () => ({ available: true }) }));
vi.mock("@tentacle-tv/api-client", () => {
  const mutation = { mutate: () => undefined, mutateAsync: async () => undefined, isError: false };
  return {
    useServerCapability: () => h.capable,
    useFamilySwitches: () => ({ data: h.switches, isError: false }),
    useFamilyCreationDefaults: () => ({ data: h.capable ? h.defaults : undefined, isError: false }),
    useSetFamilySwitches: () => mutation,
    useSetFamilyCreationDefaults: () => mutation,
  };
});

const { FamilySwitchesSection } = await import("./FamilySwitchesSection");

const render = () => renderToStaticMarkup(<FamilySwitchesSection />);
const checked = (html: string) => [...html.matchAll(/aria-checked="true"[^>]*>([^<]+)</g)].map((m) => m[1]);

beforeEach(() => {
  h.capable = true;
  h.switches = { families: true, guests: true };
  h.defaults = { createFamily: false, createGuests: true };
});

describe("FamilySwitchesSection", () => {
  it("serveur récent : deux choix à trois positions, aucune bascule « Par défaut »", () => {
    const html = render();
    expect(html.match(/role="radiogroup"/g)).toHaveLength(2);
    expect(html.match(/role="radio"/g)).toHaveLength(6);
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Default");
    expect(checked(html)).toEqual(["admin.familiesLevel_allowed", "admin.guestsLevel_everyone"]);
    expect(html).toContain("admin.familiesLevelDetail_allowed");
    expect(html).toContain("admin.guestsLevelDetail_everyone");
  });

  it("1.30.0, une extension sait demander : « Les invités peuvent demander des films », coupé tant qu'on ne l'allume pas", () => {
    h.switches = { families: true, guests: true, requestExtension: true } as FamilySwitches;
    let html = render();
    expect(html.match(/role="radiogroup"/g)).toHaveLength(3);
    expect(checked(html)).toEqual(["admin.familiesLevel_allowed", "admin.guestsLevel_everyone", "admin.guestRequestsLevel_off"]);
    expect(html).toContain("admin.guestRequestsLevelDetail_off");
    h.switches = { families: true, guests: true, guestRequests: true, requestExtension: true } as FamilySwitches;
    h.defaults = { createFamily: false, createGuests: true, grantGuestRequests: false };
    html = render();
    expect(checked(html)[2]).toBe("admin.guestRequestsLevel_allowed");
  });

  it("sans extension qui sait demander : la rangée n'existe pas, même allumée", () => {
    h.switches = { families: true, guests: true, guestRequests: true, requestExtension: false } as FamilySwitches;
    expect(render()).not.toContain("admin.guestRequests");
  });

  it("familles coupées : « Coupées », et les invités disent qu'ils ne s'ouvrent pas", () => {
    h.switches = { families: false, guests: true };
    const html = render();
    expect(checked(html)).toEqual(["admin.familiesLevel_off", "admin.guestsLevel_everyone"]);
    expect(html).toContain("admin.guestsNeedFamilies");
  });

  it("défauts pas encore lus : l'attente, jamais une position supposée", () => {
    h.defaults = undefined;
    const html = render();
    expect(html).not.toContain("radiogroup");
    expect(html).toContain("animate-pulse");
  });

  it("serveur d'avant `family.creationRights` : les deux interrupteurs, comme alors", () => {
    h.capable = false;
    const html = render();
    expect(html).not.toContain("radiogroup");
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html).toContain("admin.familiesHint");
    expect(html).toContain("admin.guestsHint");
  });
});
