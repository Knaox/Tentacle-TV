import { describe, expect, it } from "vitest";
import {
  AVATAR_INVITE_SEEN_KEY,
  markAccountInvited,
  readInvitedAccounts,
  shouldInviteToAvatars,
  type AvatarInviteContext,
} from "./inviteRule";

const ready: AvatarInviteContext = {
  desktop: true,
  userId: "u1",
  personalSession: true,
  online: true,
  hasPhoto: false,
  busy: false,
  invited: [],
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("l'invitation unique à choisir un avatar", () => {
  it("s'ouvre pour un compte sans photo, sur le bureau, en session personnelle et en ligne", () => {
    expect(shouldInviteToAvatars(ready)).toBe(true);
  });

  it("ne dérange pas un compte qui a déjà une photo, ni tant que Jellyfin n'a pas répondu", () => {
    expect(shouldInviteToAvatars({ ...ready, hasPhoto: true })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, hasPhoto: undefined })).toBe(false);
  });

  it("attend son tour : web, profil de la Famille, hors ligne, autre recouvrement ouvert", () => {
    expect(shouldInviteToAvatars({ ...ready, desktop: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, personalSession: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, online: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, busy: true })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, userId: null })).toBe(false);
  });

  it("une seule fois par compte et par appareil", () => {
    const storage = memoryStorage();
    expect(readInvitedAccounts(storage)).toEqual([]);
    const invited = markAccountInvited("u1", storage);
    expect(shouldInviteToAvatars({ ...ready, invited })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, userId: "u2", invited })).toBe(true);
  });

  it("garde le plus récent en tête, sans doublon, et lit une valeur abîmée comme vide", () => {
    const storage = memoryStorage();
    markAccountInvited("a", storage);
    markAccountInvited("b", storage);
    expect(markAccountInvited("a", storage)).toEqual(["a", "b"]);
    expect(readInvitedAccounts(memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: "{oups" }))).toEqual([]);
    expect(readInvitedAccounts(memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: "[1, \"x\"]" }))).toEqual(["x"]);
  });
});
