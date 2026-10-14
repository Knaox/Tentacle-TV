import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY } from "@tentacle-tv/shared";
import { markSubjectInvited, readInvitedSubjects } from "./inviteRule";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("le stockage de l'invitation aux avatars (web, bureau)", () => {
  it("note les sujets invités sous la clé partagée, le plus récent en tête", () => {
    const storage = memoryStorage();
    expect(readInvitedSubjects(storage)).toEqual([]);
    markSubjectInvited("a", storage);
    expect(markSubjectInvited("b", storage)).toEqual(["b", "a"]);
    expect(storage.getItem(AVATAR_INVITE_SEEN_KEY)).toBe('["b","a"]');
  });

  it("lit une valeur abîmée comme vide, sans casse", () => {
    expect(readInvitedSubjects(memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: "{oups" }))).toEqual([]);
    expect(readInvitedSubjects(null)).toEqual([]);
  });
});
