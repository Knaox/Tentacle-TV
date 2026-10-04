import { describe, expect, it } from "vitest";
import type { FamilyRights, TvProfileDto, TvProfilesDto } from "@tentacle-tv/shared";

import { manageEntryProfile } from "./profileLaunch";
import { profileManages, profileRecordOf, recordManages, recordPairedTheTv, type TvProfileRecord } from "./tvProfileSession";

/** La Famille PARTAGÉE (contrat v2) sur l'Apple TV : la TV d'un membre montre toute la famille. */

const OWNER_RIGHTS: FamilyRights = { manageMembers: true, createGuests: true, manageGuests: "all" };
const MEMBER_RIGHTS: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "own" };

const profile = (userId: string, patch: Partial<TvProfileDto> = {}): TvProfileDto => ({
  userId, kind: "member", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, manage: null, ...patch,
});

const ANNE = profile("anne", { kind: "owner", manage: OWNER_RIGHTS });
const MARC = profile("marc", { manage: MEMBER_RIGHTS });
const ZOE = profile("zoe", { kind: "guest", createdBy: "marc" });

/** La TV de Marc, membre de la famille d'Anne. */
const marcsTv = (patch: Partial<TvProfilesDto> = {}): TvProfilesDto => ({
  v: 2,
  switches: { families: true, guests: true },
  pairedBy: { userId: "marc", name: "marc" },
  owner: { userId: "marc", name: "marc" },
  profiles: [ANNE, MARC, ZOE],
  stickyProfileId: null,
  pickerRequired: true,
  canManage: true,
  ...patch,
});

/** Un listing v1 : ni `pairedBy`, ni `manage`, ni `createdBy`. */
const v1Listing = (): TvProfilesDto => {
  const strip = ({ manage: _m, createdBy: _c, ...rest }: TvProfileDto) => rest as TvProfileDto;
  const { pairedBy: _p, ...listing } = marcsTv({ owner: { userId: "anne", name: "anne" } });
  return { ...listing, v: 1, profiles: [ANNE, MARC, ZOE].map(strip) } as TvProfilesDto;
};

describe("la famille partagée sur la TV d'un membre", () => {
  it("retient le compte de la TV et le propriétaire de la famille, séparément", () => {
    const record = profileRecordOf(ZOE, marcsTv(), "picked");
    expect(record.ownerId).toBe("marc");
    expect(record.familyOwnerName).toBe("anne");
    expect(recordPairedTheTv(record)).toBe(false);
    expect(recordPairedTheTv(profileRecordOf(MARC, marcsTv(), "picked"))).toBe(true);
    // La propriétaire ne déjumelle pas la TV de Marc : seul son compte le fait.
    expect(recordPairedTheTv(profileRecordOf(ANNE, marcsTv(), "picked"))).toBe(false);
  });

  it("ne donne « Gérer les profils » qu'aux profils qui ont quelque chose à y gérer", () => {
    expect(profileManages(ANNE, marcsTv())).toBe(true);
    expect(profileManages(MARC, marcsTv())).toBe(true);
    expect(profileManages(ZOE, marcsTv())).toBe(false);
    expect(recordManages(profileRecordOf(MARC, marcsTv(), "picked"))).toBe(true);
    expect(recordManages(profileRecordOf(ZOE, marcsTv(), "picked"))).toBe(false);
  });

  it("depuis « Qui regarde ? », gère avec le profil du compte de la TV, sinon le premier qui gère", () => {
    expect(manageEntryProfile(marcsTv())?.userId).toBe("marc");
    const marcWithoutRights = marcsTv({ profiles: [ANNE, { ...MARC, manage: null }, ZOE] });
    expect(manageEntryProfile(marcWithoutRights)?.userId).toBe("anne");
    expect(manageEntryProfile(marcsTv({ canManage: false }))).toBeNull();
  });
});

describe("un serveur d'avant la famille partagée (v1)", () => {
  it("garde la règle d'avant : le propriétaire seul gère et déjumelle", () => {
    const listing = v1Listing();
    expect(profileManages(listing.profiles[0], listing)).toBe(true);
    expect(profileManages(listing.profiles[1], listing)).toBe(false);
    expect(manageEntryProfile(listing)?.userId).toBe("anne");
    const record = profileRecordOf(listing.profiles[0], listing, "picked");
    expect(record.ownerId).toBe("anne");
    expect(recordPairedTheTv(record)).toBe(true);
  });

  it("relit un enregistrement d'avant sans `manages` ni `familyOwnerName`", () => {
    const old = { ...profileRecordOf(ANNE, marcsTv(), "sticky") } as Partial<TvProfileRecord>;
    delete old.manages;
    delete old.familyOwnerName;
    expect(recordManages({ ...(old as TvProfileRecord), kind: "owner", canManage: true })).toBe(true);
    expect(recordManages({ ...(old as TvProfileRecord), kind: "member", canManage: true })).toBe(false);
  });
});
