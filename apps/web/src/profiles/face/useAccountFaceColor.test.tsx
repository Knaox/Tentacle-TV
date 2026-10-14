import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";

/**
 * La couleur du rond du compte (recette du 14/10 : violet « B » dans la barre,
 * ORANGE dans « Changer de profil » et sur « Qui regarde ? ») : la couleur du
 * profil partout dès qu'il y a une famille à montrer ; la marque sinon.
 */

const state = vi.hoisted(() => ({
  active: null as null | { id: string; color: string },
  enabled: true,
  listing: undefined as PickerProfilesDto | undefined,
  mirror: null as null | { server: string; accountId: string; capable: boolean; listing: PickerProfilesDto | null },
  mirrorReads: 0,
}));

vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => state.active }));
vi.mock("../api/usePickerListing", () => ({
  usePickerListingQuery: () => ({ listing: { data: state.listing }, enabled: state.enabled, accountId: "owner" }),
}));
vi.mock("../launch/launchState", () => ({
  readLaunchMirror: () => {
    state.mirrorReads += 1;
    return state.mirror;
  },
}));
vi.mock("../../lib/backendBase", () => ({ getBackendBase: () => "http://maison:3000" }));

const { useAccountFaceColor, personalColorOf } = await import("./useAccountFaceColor");

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "member", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

const FAMILY: PickerProfilesDto = {
  v: 2,
  platform: "desktop",
  switches: { families: true, guests: true },
  account: { userId: "owner", name: "Banc" },
  profiles: [profile("owner", { kind: "owner", color: "orange", personal: true }), profile("zoe"), profile("lea", { kind: "guest", color: "pink" })],
  currentProfileId: "owner",
  pickerRequired: true,
  atLaunch: false,
};

function Probe() {
  return <i>{useAccountFaceColor() ?? "brand"}</i>;
}

const face = () => renderToStaticMarkup(<Probe />).replace(/<\/?i>/g, "");

describe("la couleur du rond du compte", () => {
  beforeEach(() => {
    state.active = null;
    state.enabled = true;
    state.listing = undefined;
    state.mirror = null;
    state.mirrorReads = 0;
  });

  it("session personnelle dans une famille : la couleur de son profil", () => {
    state.listing = FAMILY;
    expect(face()).toBe("orange");
    expect(state.mirrorReads).toBe(0);
  });

  it("session d'un profil : la sienne", () => {
    state.active = { id: "lea", color: "pink" };
    state.listing = FAMILY;
    expect(face()).toBe("pink");
  });

  it("famille d'un seul profil : la marque, comme avant", () => {
    state.listing = { ...FAMILY, profiles: [FAMILY.profiles[0]!], pickerRequired: false };
    expect(face()).toBe("brand");
  });

  it("serveur sans la capacité, web ou mobile : la marque, sans lire le miroir", () => {
    state.enabled = false;
    state.mirror = { server: "http://maison:3000", accountId: "owner", capable: true, listing: FAMILY };
    expect(face()).toBe("brand");
    expect(state.mirrorReads).toBe(0);
  });

  it("la liste pas encore revenue : le miroir de l'ouverture, même serveur et même compte", () => {
    state.mirror = { server: "http://maison:3000", accountId: "owner", capable: true, listing: FAMILY };
    expect(face()).toBe("orange");
  });

  it("le miroir d'un autre compte ou d'un autre serveur ne vaut rien", () => {
    state.mirror = { server: "http://maison:3000", accountId: "someone", capable: true, listing: FAMILY };
    expect(face()).toBe("brand");
    state.mirror = { server: "http://ailleurs:3000", accountId: "owner", capable: true, listing: FAMILY };
    expect(face()).toBe("brand");
  });

  it("la règle pure : aucune famille à montrer, aucune couleur", () => {
    expect(personalColorOf(null)).toBeNull();
    expect(personalColorOf({ pickerRequired: true, profiles: [profile("zoe")] })).toBeNull();
    expect(personalColorOf(FAMILY)).toBe("orange");
  });
});
