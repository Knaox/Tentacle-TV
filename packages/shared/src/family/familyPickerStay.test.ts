import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "./familyPickerContract";
import { pickerLaunch } from "./familyPickerClient";
import { pickerStayChecked, pickerStayOf, pickerStayState, stayOverridesPicker } from "./familyPickerStay";

const NOW = Date.parse("2026-10-14T12:00:00Z");

const profile = (userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto => ({
  userId,
  kind: "member",
  name: userId,
  color: "violet",
  hasPin: false,
  imageTag: null,
  lockedUntil: null,
  createdBy: null,
  personal: false,
  ...extra,
});

function listing(extra: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "moi", name: "Moi" },
    profiles: [
      profile("moi", { kind: "owner", personal: true, hasPin: true }),
      profile("lea", { hasPin: true }),
      profile("zoe", { kind: "guest", createdBy: "moi" }),
    ],
    currentProfileId: "moi",
    pickerRequired: true,
    atLaunch: true,
    ...extra,
  };
}

describe("« Ne plus proposer sur cet appareil » — l'état du profil retenu", () => {
  it("vaut tant que le profil est là, avec le même état de code", () => {
    expect(pickerStayState(listing(), { profileId: "lea", hasPin: true }, NOW)).toBe("valid");
    expect(pickerStayState(listing(), { profileId: "zoe", hasPin: false }, NOW)).toBe("valid");
  });

  it("est à oublier si le profil a quitté la famille, ou si son code a été posé ou retiré", () => {
    expect(pickerStayState(listing(), { profileId: "parti", hasPin: false }, NOW)).toBe("stale");
    expect(pickerStayState(listing(), { profileId: "zoe", hasPin: true }, NOW)).toBe("stale");
    expect(pickerStayState(listing(), { profileId: "lea", hasPin: false }, NOW)).toBe("stale");
  });

  it("est gardé mais suspendu pendant un blocage (trop d'essais ratés), comme sur la TV", () => {
    const locked = listing({ profiles: [profile("moi", { personal: true }), profile("lea", { hasPin: true, lockedUntil: "2026-10-14T12:15:00Z" })] });
    expect(pickerStayState(locked, { profileId: "lea", hasPin: true }, NOW)).toBe("locked");
    expect(pickerStayState(locked, { profileId: "lea", hasPin: true }, Date.parse("2026-10-14T12:16:00Z"))).toBe("valid");
  });

  it("retient le profil choisi et l'état de son code", () => {
    expect(pickerStayOf(profile("lea", { hasPin: true }))).toEqual({ profileId: "lea", hasPin: true });
  });
});

describe("à l'ouverture, la préférence du compte cède au profil retenu — et à lui seul", () => {
  it("le compte retenu, en cours sur l'appareil : sa session s'ouvre, sans son code (comme la TV)", () => {
    expect(pickerLaunch(listing(), null, { profileId: "moi", hasPin: true }, NOW)).toBe("personal");
  });

  it("un profil retenu, en cours, dont l'application garde le jeton : il reprend", () => {
    expect(pickerLaunch(listing({ currentProfileId: "lea" }), { profileId: "lea" }, { profileId: "lea", hasPin: true }, NOW)).toBe("resume");
  });

  it("ne rouvre JAMAIS le compte sans son PIN quand l'appareil était sur un autre profil", () => {
    // Le compte retenu, mais l'appareil est sur Léa (jeton gardé ou perdu) : « Qui regarde ? ».
    const onLea = listing({ currentProfileId: "lea" });
    expect(pickerLaunch(onLea, { profileId: "lea" }, { profileId: "moi", hasPin: true }, NOW)).toBe("picker");
    expect(pickerLaunch(onLea, null, { profileId: "moi", hasPin: true }, NOW)).toBe("picker");
    // Léa retenue et en cours, mais l'application n'a plus son jeton : jamais le compte à sa place.
    expect(pickerLaunch(onLea, null, { profileId: "lea", hasPin: true }, NOW)).toBe("picker");
    expect(pickerLaunch(onLea, { profileId: "zoe" }, { profileId: "lea", hasPin: true }, NOW)).toBe("picker");
  });

  it("un profil retenu qui n'est plus valable (parti, code changé, bloqué) : « Qui regarde ? »", () => {
    expect(pickerLaunch(listing(), null, { profileId: "moi", hasPin: false }, NOW)).toBe("picker");
    const locked = listing({ profiles: [profile("moi", { personal: true, lockedUntil: "2026-10-14T12:15:00Z" }), profile("zoe")] });
    expect(pickerLaunch(locked, null, { profileId: "moi", hasPin: false }, NOW)).toBe("picker");
  });

  it("sans choix retenu, ou sans la liste des profils : la préférence, comme avant", () => {
    expect(pickerLaunch(listing(), null, null, NOW)).toBe("picker");
    const { profiles: _profiles, ...withoutProfiles } = listing();
    expect(pickerLaunch(withoutProfiles, null, { profileId: "moi", hasPin: true }, NOW)).toBe("picker");
  });

  it("préférence coupée : rien ne change, le choix retenu n'ajoute rien", () => {
    expect(pickerLaunch(listing({ atLaunch: false }), null, { profileId: "zoe", hasPin: false }, NOW)).toBe("personal");
    expect(stayOverridesPicker(listing(), null, NOW)).toBe(false);
  });
});

describe("la case à l'arrivée sur « Qui regarde ? »", () => {
  it("cochée si l'appareil retient encore un profil de la famille, décochée sinon", () => {
    expect(pickerStayChecked(listing(), { profileId: "lea", hasPin: true }, NOW)).toBe(true);
    expect(pickerStayChecked(listing(), { profileId: "parti", hasPin: false }, NOW)).toBe(false);
    expect(pickerStayChecked(listing(), null, NOW)).toBe(false);
  });
});
