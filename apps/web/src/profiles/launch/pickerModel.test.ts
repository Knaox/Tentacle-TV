import { describe, expect, it } from "vitest";
import { PIN_ENTRY_START, type PickerProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { orderedProfiles, pickerModelOf, pickerProfileOf } from "./pickerModel";

const NOW = Date.parse("2026-10-14T22:00:00Z");
const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key);

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

function listing(profiles: PickerProfileDto[]): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "zoe", name: "Zoé" },
    profiles,
    currentProfileId: "zoe",
    pickerRequired: profiles.length >= 2,
    atLaunch: true,
  };
}

const FAMILY = [profile("damien", { kind: "owner" }), profile("zoe", { kind: "member", personal: true, hasPin: true }), profile("lea")];

describe("ce que « Qui regarde ? » montre", () => {
  it("SON profil en tête, puis la famille dans l'ordre du serveur", () => {
    expect(orderedProfiles(FAMILY).map((p) => p.userId)).toEqual(["zoe", "damien", "lea"]);
  });

  it("un profil : invité, code PIN, et « bloqué jusqu'à » seulement tant que le blocage dure", () => {
    const lea = pickerProfileOf(profile("lea", { lockedUntil: "2026-10-14T22:15:00Z" }), NOW, "fr", t);
    expect(lea).toMatchObject({ id: "lea", guest: true, own: false });
    expect(lea.lockedLabel).toContain("lockedUntil");
    expect(pickerProfileOf(profile("lea", { lockedUntil: "2026-10-14T21:00:00Z" }), NOW, "fr", t).lockedLabel).toBeNull();
    expect(pickerProfileOf(FAMILY[1]!, NOW, "fr", t)).toMatchObject({ own: true, hasPin: true, guest: false });
  });

  it("chargement, puis l'erreur si rien n'est connu", () => {
    const flow = { pin: null, opening: null, notice: null };
    expect(pickerModelOf({ listing: null, error: null, flow, openingLabel: null, language: "fr", t, now: NOW })).toEqual({ kind: "loading" });
    expect(pickerModelOf({ listing: null, error: "illisible", flow, openingLabel: null, language: "fr", t, now: NOW }))
      .toEqual({ kind: "error", message: "illisible" });
  });

  it("la rangée : l'entrée dans un profil et le refus à dire", () => {
    const model = pickerModelOf({
      listing: listing(FAMILY),
      error: null,
      flow: { pin: null, opening: "lea", notice: "retiré" },
      openingLabel: "Ouverture…",
      language: "fr",
      t,
      now: NOW,
    });
    expect(model).toMatchObject({ kind: "picker", canManage: true, notice: "retiré", entering: { id: "lea", label: "Ouverture…" } });
    if (model.kind === "picker") expect(model.profiles.map((p) => p.id)).toEqual(["zoe", "damien", "lea"]);
  });

  it("le pavé du profil choisi : chiffres tapés, phase et message", () => {
    const entry = { ...PIN_ENTRY_START, digits: "12" };
    const model = pickerModelOf({
      listing: listing(FAMILY),
      error: null,
      flow: { pin: { profile: FAMILY[1]!, entry, message: null }, opening: null, notice: null },
      openingLabel: null,
      language: "fr",
      t,
      now: NOW,
    });
    expect(model).toMatchObject({ kind: "pin", pad: { typed: 2, phase: "typing", message: null, profile: { id: "zoe" } } });
  });
});
