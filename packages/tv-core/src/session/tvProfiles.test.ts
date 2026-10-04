import { describe, expect, it } from "vitest";
import type { TvProfileDto, TvProfilesDto } from "@tentacle-tv/shared";

import { TV_KNOWN_PROFILES_KEY, TV_PAIRING_TOKEN_KEY, TV_PROFILE_KEY } from "./tvProfileKeys";
import {
  coldStartProfile,
  profileRecordOf,
  readProfileRecord,
  resumesOnLaunch,
  tvSessionMode,
  writeProfileRecord,
  type TvProfileRecord,
} from "./tvProfileSession";
import { findProfile, isProfileLocked, pickerEntryIndex, planProfileLaunch, planProfilePick } from "./profileLaunch";
import { readKnownProfiles, rememberProfiles } from "./knownProfiles";
import type { SessionStorage } from "./unpairJournal";

function fakeStorage(initial: Record<string, string> = {}) {
  const content = new Map(Object.entries(initial));
  const storage: SessionStorage = {
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => { content.set(k, v); },
    removeItem: (k) => { content.delete(k); },
  };
  return { storage, content };
}

const NOW = Date.parse("2026-10-04T22:00:00Z");

const profile = (userId: string, patch: Partial<TvProfileDto> = {}): TvProfileDto => ({
  userId, kind: "member", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, manage: null, ...patch,
});

const listing = (profiles: TvProfileDto[], patch: Partial<TvProfilesDto> = {}): TvProfilesDto => ({
  v: 1,
  switches: { families: true, guests: true },
  pairedBy: { userId: profiles[0].userId, name: profiles[0].name },
  owner: { userId: profiles[0].userId, name: profiles[0].name },
  profiles,
  stickyProfileId: null,
  pickerRequired: profiles.length >= 2,
  canManage: true,
  ...patch,
});

const OWNER = profile("damien", { kind: "owner" });
const LEA = profile("lea", { kind: "guest" });
const NINA = profile("nina", { hasPin: true });

const record = (launch: TvProfileRecord["launch"], hasPin = false): TvProfileRecord =>
  profileRecordOf({ ...LEA, hasPin }, listing([OWNER, LEA]), launch);

describe("la session d'une Apple TV passée aux profils", () => {
  it("dit l'état de la TV d'après ses deux jetons", () => {
    expect(tvSessionMode(fakeStorage().storage)).toBe("unpaired");
    expect(tvSessionMode(fakeStorage({ tentacle_token: "jwt" }).storage)).toBe("legacy");
    expect(tvSessionMode(fakeStorage({ [TV_PAIRING_TOKEN_KEY]: "p" }).storage)).toBe("choosing");
    // Un jeton de session sans son profil retenu ne vaut pas session.
    expect(tvSessionMode(fakeStorage({ [TV_PAIRING_TOKEN_KEY]: "p", tentacle_token: "s" }).storage)).toBe("choosing");
    const { storage } = fakeStorage({ [TV_PAIRING_TOKEN_KEY]: "p", tentacle_token: "s" });
    writeProfileRecord(storage, record("picked"));
    expect(tvSessionMode(storage)).toBe("profile");
  });

  it("relit le profil retenu, et refuse un enregistrement incomplet", () => {
    const { storage } = fakeStorage();
    writeProfileRecord(storage, record("sticky"));
    expect(readProfileRecord(storage)).toEqual(record("sticky"));
    expect(readProfileRecord(fakeStorage({ [TV_PROFILE_KEY]: '{"profileId":"lea"}' }).storage)).toBeNull();
    expect(readProfileRecord(fakeStorage({ [TV_PROFILE_KEY]: "{oups" }).storage)).toBeNull();
  });

  it("au démarrage à froid, ne reprend que « Rester » ou le seul profil sans PIN", () => {
    expect(resumesOnLaunch(record("sticky", true))).toBe(true);
    expect(resumesOnLaunch(record("single"))).toBe(true);
    // Relancer l'app ne contourne jamais un code.
    expect(resumesOnLaunch(record("single", true))).toBe(false);
    expect(resumesOnLaunch(record("picked"))).toBe(false);
    expect(resumesOnLaunch(null)).toBe(false);
  });

  it("décide du démarrage à froid avant que rien ne lise la session", () => {
    const paired = { [TV_PAIRING_TOKEN_KEY]: "p", tentacle_token: "s" };
    const sticky = fakeStorage(paired);
    writeProfileRecord(sticky.storage, record("sticky"));
    expect(coldStartProfile(sticky.storage)).toBe("resume");
    const picked = fakeStorage(paired);
    writeProfileRecord(picked.storage, record("picked"));
    expect(coldStartProfile(picked.storage)).toBe("leave");
    expect(coldStartProfile(fakeStorage(paired).storage)).toBe("leave");
    expect(coldStartProfile(fakeStorage({ tentacle_token: "jwt" }).storage)).toBe("none");
    expect(coldStartProfile(fakeStorage({ [TV_PAIRING_TOKEN_KEY]: "p" }).storage)).toBe("none");
  });
});

describe("le profil à ouvrir", () => {
  it("ouvre seul le profil « Rester », sans PIN", () => {
    const plan = planProfileLaunch(listing([OWNER, NINA], { stickyProfileId: "NINA".toLowerCase() }), "launch", NOW);
    expect(plan).toEqual({ kind: "open", profileId: "nina", remember: true, launch: "sticky" });
  });

  it("un profil « Rester » bloqué repasse par « Qui regarde ? »", () => {
    const locked = { ...NINA, lockedUntil: "2026-10-04T22:15:00Z" };
    expect(planProfileLaunch(listing([OWNER, locked], { stickyProfileId: "nina" }), "launch", NOW)).toEqual({ kind: "picker" });
  });

  it("ouvre le seul profil, après son PIN s'il en a un", () => {
    expect(planProfileLaunch(listing([OWNER]), "launch", NOW)).toEqual({ kind: "open", profileId: "damien", remember: false, launch: "single" });
    const guarded = { ...OWNER, hasPin: true };
    expect(planProfileLaunch(listing([guarded]), "launch", NOW)).toEqual({ kind: "pin", profileId: "damien", launch: "single" });
  });

  it("montre « Qui regarde ? » dès deux profils, et toujours pour « Changer de profil »", () => {
    expect(planProfileLaunch(listing([OWNER, LEA]), "launch", NOW)).toEqual({ kind: "picker" });
    expect(planProfileLaunch(listing([OWNER]), "switch", NOW)).toEqual({ kind: "picker" });
  });

  it("au choix d'un profil : son PIN d'abord, sauf s'il est « Rester » sur cette TV", () => {
    expect(planProfilePick(NINA, { stickyProfileId: null }, false, NOW)).toEqual({ kind: "pin", remember: false, launch: "picked" });
    expect(planProfilePick(NINA, { stickyProfileId: "nina" }, false, NOW)).toEqual({ kind: "open", remember: false, launch: "picked" });
    expect(planProfilePick(LEA, { stickyProfileId: null }, true, NOW)).toEqual({ kind: "open", remember: true, launch: "sticky" });
    const locked = { ...NINA, lockedUntil: "2026-10-04T23:00:00Z" };
    expect(planProfilePick(locked, { stickyProfileId: null }, false, NOW)).toEqual({ kind: "locked", until: "2026-10-04T23:00:00Z" });
  });

  it("un blocage échu ne bloque plus", () => {
    expect(isProfileLocked({ lockedUntil: "2026-10-04T21:00:00Z" }, NOW)).toBe(false);
    expect(isProfileLocked({ lockedUntil: "pas une date" }, NOW)).toBe(false);
  });

  it("retrouve un profil sans se soucier des tirets ni de la casse, et y pose le focus", () => {
    const list = listing([profile("AB-12"), profile("cd34")]);
    expect(findProfile(list, "ab12")?.userId).toBe("AB-12");
    expect(pickerEntryIndex(list, "CD34")).toBe(1);
    expect(pickerEntryIndex(list, "parti")).toBe(0);
    expect(pickerEntryIndex(list, null)).toBe(0);
  });
});

describe("les profils déjà vus", () => {
  it("rend ceux qui ont quitté la famille", () => {
    const { storage } = fakeStorage({ [TV_KNOWN_PROFILES_KEY]: '["damien","lea","nina"]' });
    expect(rememberProfiles(storage, ["damien", "NINA"])).toEqual(["lea"]);
    expect(readKnownProfiles(storage)).toEqual(["damien", "NINA"]);
    expect(readKnownProfiles(fakeStorage({ [TV_KNOWN_PROFILES_KEY]: "[3,null" }).storage)).toEqual([]);
  });
});
