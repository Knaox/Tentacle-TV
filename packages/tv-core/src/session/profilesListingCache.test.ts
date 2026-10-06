import { describe, expect, it } from "vitest";
import type { TvProfilesDto } from "@tentacle-tv/shared";

import { cachedPicker, cacheProfiles, readCachedProfiles } from "./profilesListingCache";
import { TV_PROFILES_LISTING_KEY } from "./tvProfileKeys";
import { ACCOUNT_STORAGE_KEYS, PROFILE_STORAGE_KEYS, type SessionStorage } from "./unpairJournal";

function fakeStorage(initial: Record<string, string> = {}): SessionStorage {
  const content = new Map(Object.entries(initial));
  return {
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => { content.set(k, v); },
    removeItem: (k) => { content.delete(k); },
  };
}

const LISTING: TvProfilesDto = {
  v: 2,
  switches: { families: true, guests: true },
  pairedBy: { userId: "damien", name: "Damien" },
  owner: { userId: "damien", name: "Damien" },
  profiles: [
    { userId: "damien", kind: "owner", name: "Damien", color: "violet", hasPin: true, imageTag: "t1", lockedUntil: null, createdBy: null, manage: null },
    { userId: "lea", kind: "guest", name: "Léa", color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: "damien", manage: null },
  ],
  stickyProfileId: null,
  pickerRequired: true,
  canManage: true,
};

describe("la dernière liste de « Qui regarde ? »", () => {
  it("se relit telle qu'elle a été gardée", () => {
    const storage = fakeStorage();
    expect(readCachedProfiles(storage)).toBeNull();
    cacheProfiles(storage, LISTING);
    expect(readCachedProfiles(storage)).toEqual(LISTING);
  });

  it("refuse une liste illisible, vide ou d'une forme inconnue", () => {
    expect(readCachedProfiles(fakeStorage({ [TV_PROFILES_LISTING_KEY]: "{oups" }))).toBeNull();
    expect(readCachedProfiles(fakeStorage({ [TV_PROFILES_LISTING_KEY]: JSON.stringify({ ...LISTING, profiles: [] }) }))).toBeNull();
    const odd = { ...LISTING, profiles: [{ ...LISTING.profiles[0], kind: "chef" }] };
    expect(readCachedProfiles(fakeStorage({ [TV_PROFILES_LISTING_KEY]: JSON.stringify(odd) }))).toBeNull();
  });

  it("part avec le jumelage, reste quand on quitte un profil", () => {
    expect(ACCOUNT_STORAGE_KEYS).toContain(TV_PROFILES_LISTING_KEY);
    expect(PROFILE_STORAGE_KEYS).not.toContain(TV_PROFILES_LISTING_KEY);
  });

  it("donne la rangée à montrer d'emblée, sauf si un profil s'ouvrirait seul", () => {
    const storage = fakeStorage();
    expect(cachedPicker(storage, "launch", 0)).toBeNull();
    cacheProfiles(storage, { ...LISTING, pairedBy: { userId: "lea", name: "Léa" } });
    // Le compte de la TV en tête de la rangée.
    expect(cachedPicker(storage, "launch", 0)?.profiles.map((p) => p.userId)).toEqual(["lea", "damien"]);
    cacheProfiles(storage, { ...LISTING, stickyProfileId: "lea" });
    expect(cachedPicker(storage, "launch", 0)).toBeNull();
    expect(cachedPicker(storage, "switch", 0)?.profiles).toHaveLength(2);
    // Le compte seul, sans famille ni PIN : il s'ouvre, pas de rangée.
    cacheProfiles(storage, { ...LISTING, profiles: [{ ...LISTING.profiles[0], hasPin: false }] });
    expect(cachedPicker(storage, "launch", 0)).toBeNull();
  });
});
