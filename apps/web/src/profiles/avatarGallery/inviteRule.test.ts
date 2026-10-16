import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY } from "@tentacle-tv/shared";
import { honorDesktopPromptsReset, markSubjectInvited, readInvitedSubjects } from "./inviteRule";

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

describe("honorDesktopPromptsReset — « Reproposer le code PIN et la photo »", () => {
  function memory() {
    const map = new Map<string, string>();
    return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  }

  it("une demande plus récente rend le sujet de nouveau invitable, une fois", () => {
    const storage = memory();
    markSubjectInvited("zoe", storage);
    expect(honorDesktopPromptsReset("zoe", "2026-10-16T10:00:00.000Z", storage)).toBe(true);
    expect(readInvitedSubjects(storage)).not.toContain("zoe");
    markSubjectInvited("zoe", storage);
    expect(honorDesktopPromptsReset("zoe", "2026-10-16T10:00:00.000Z", storage)).toBe(false);
    expect(readInvitedSubjects(storage)).toContain("zoe");
  });

  it("un serveur d'avant (pas de date) : l'invitation reste passée", () => {
    const storage = memory();
    markSubjectInvited("zoe", storage);
    expect(honorDesktopPromptsReset("zoe", undefined, storage)).toBe(false);
    expect(readInvitedSubjects(storage)).toContain("zoe");
  });
});
