import { describe, expect, it } from "vitest";
import type { FamilyRights, TvProfileDto, TvProfilesDto } from "@tentacle-tv/shared";
import { openProfileState, profileManageState, recordManageState, tvProfileRoleOf } from "./profileRole";
import { profileRecordOf, readProfileRecord, writeProfileRecord, type TvProfileRecord } from "./tvProfileSession";

/** Le rôle et la gestion du profil ouvert, tels que Réglages › Compte les disent (décisions du 16/10). */

const OWNER: FamilyRights = { manageMembers: true, createGuests: true, manageGuests: "all", manageRoles: true, manageMinors: true };
const PARENT: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "all", manageRoles: false, manageMinors: true };
const MEMBER: FamilyRights = { manageMembers: false, createGuests: false, manageGuests: "own", manageRoles: false, manageMinors: false };

const profile = (userId: string, patch: Partial<TvProfileDto> = {}): TvProfileDto => ({
  userId, kind: "member", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, manage: null, ...patch,
});

const listingOf = (...profiles: TvProfileDto[]): TvProfilesDto => ({
  v: 2,
  switches: { families: true, guests: true },
  pairedBy: { userId: "anne", name: "anne" },
  owner: { userId: "anne", name: "anne" },
  profiles,
  stickyProfileId: null,
  pickerRequired: true,
  canManage: true,
});

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), removeItem: (key: string) => void map.delete(key) };
}

describe("le rôle d'un profil", () => {
  it("dit « parent » d'un membre nommé parent, que le serveur le dise ou que ses droits le montrent", () => {
    expect(tvProfileRoleOf(profile("marc", { parent: true } as Partial<TvProfileDto>))).toBe("parent");
    expect(tvProfileRoleOf(profile("marc", { hasPin: true, manage: PARENT }))).toBe("parent");
    expect(tvProfileRoleOf(profile("marc", { hasPin: true, manage: MEMBER }))).toBe("member");
    expect(tvProfileRoleOf(profile("anne", { kind: "owner", manage: OWNER }))).toBe("owner");
    expect(tvProfileRoleOf(profile("zoe", { kind: "guest" }))).toBe("guest");
  });

  it("retient le rôle à l'ouverture, et relit un enregistrement d'avant sans lui", () => {
    const storage = memoryStorage();
    const record = profileRecordOf(profile("marc", { hasPin: true, manage: PARENT }), listingOf(), "picked");
    expect(record.parent).toBe(true);
    writeProfileRecord(storage, record);
    expect(readProfileRecord(storage)?.parent).toBe(true);
    const old = { ...record } as Partial<TvProfileRecord>;
    delete old.parent;
    delete old.manageNeedsPin;
    writeProfileRecord(storage, old as TvProfileRecord);
    expect(readProfileRecord(storage)).not.toBeNull();
  });
});

describe("la gestion depuis un profil", () => {
  it("s'offre à qui gère ET a un code ; sans code, l'indice ; un invité, rien", () => {
    const listing = listingOf();
    expect(profileManageState(profile("marc", { hasPin: true, manage: PARENT }), listing)).toBe("manage");
    // Serveur 1.30.0 : sans code, `manage` est nul et `manageNeedsPin` vrai.
    expect(profileManageState(profile("marc", { manageNeedsPin: true }), listing)).toBe("needsPin");
    // Serveur d'avant : `manage` sans code — la TV exige quand même le code.
    expect(profileManageState(profile("marc", { manage: MEMBER }), listing)).toBe("needsPin");
    expect(profileManageState(profile("marc"), listing)).toBe("none");
    expect(profileManageState(profile("zoe", { kind: "guest", hasPin: true }), listing)).toBe("none");
  });

  it("vaut aussi pour ce que la TV a retenu", () => {
    const listing = listingOf();
    const needs = profileRecordOf(profile("marc", { manageNeedsPin: true }), listing, "picked");
    expect(recordManageState(needs)).toBe("needsPin");
    // Le code posé depuis ce profil : la TV le retient aussitôt.
    expect(recordManageState({ ...needs, hasPin: true })).toBe("manage");
  });
});

describe("le profil ouvert dans Réglages", () => {
  const record = profileRecordOf(profile("marc", { hasPin: true, manage: MEMBER }), listingOf(), "picked");

  it("suit la liste RELUE : nommé parent sur le bureau, il se dit parent sans rouvrir son profil", () => {
    expect(openProfileState(record, null)).toEqual({ role: "member", manage: "manage", hasPin: true });
    const relu = listingOf(profile("marc", { hasPin: true, manage: PARENT }));
    expect(openProfileState(record, relu)).toEqual({ role: "parent", manage: "manage", hasPin: true });
  });

  it("garde le code tel que la TV le sait : posé ici à l'instant, la liste suivra", () => {
    const sansCode = profileRecordOf(profile("marc", { manageNeedsPin: true }), listingOf(), "picked");
    const pose = { ...sansCode, hasPin: true };
    const pasEncoreRelue = listingOf(profile("marc", { manageNeedsPin: true }));
    expect(openProfileState(pose, pasEncoreRelue).manage).toBe("manage");
    expect(openProfileState(sansCode, pasEncoreRelue).manage).toBe("needsPin");
  });

  it("se rabat sur l'enregistrement quand la liste ne le porte pas", () => {
    expect(openProfileState(record, listingOf(profile("autre"))).role).toBe("member");
  });
});
