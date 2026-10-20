import { describe, expect, it } from "vitest";
import {
  AVATAR_INVITE_SEEN_KEY, MOBILE_AVATAR_INVITE_ROUND, honorAvatarInviteRound, parseInvitedSubjects, shouldInviteToAvatars, withSubjectInvited,
  type AvatarInviteContext,
} from "./avatarInvite";

const ready: AvatarInviteContext = {
  eligible: true,
  subjectId: "u1",
  canChangePhoto: true,
  online: true,
  hasPhoto: false,
  busy: false,
  invited: [],
};

describe("l'invitation unique à choisir un avatar", () => {
  it("s'ouvre pour un sujet sans photo, sur une plateforme qui invite, en ligne", () => {
    expect(shouldInviteToAvatars(ready)).toBe(true);
  });

  it("ne dérange pas qui a déjà une photo, ni tant que Jellyfin n'a pas répondu", () => {
    expect(shouldInviteToAvatars({ ...ready, hasPhoto: true })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, hasPhoto: undefined })).toBe(false);
  });

  it("attend son tour : plateforme qui n'invite pas, photo qu'on ne peut changer, hors ligne, autre recouvrement", () => {
    expect(shouldInviteToAvatars({ ...ready, eligible: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, canChangePhoto: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, online: false })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, busy: true })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, subjectId: null })).toBe(false);
  });

  it("une seule fois par sujet et par appareil", () => {
    const invited = withSubjectInvited([], "u1");
    expect(shouldInviteToAvatars({ ...ready, invited })).toBe(false);
    expect(shouldInviteToAvatars({ ...ready, subjectId: "invite-lea", invited })).toBe(true);
  });

  it("garde le plus récent en tête, sans doublon, et lit une valeur abîmée comme vide", () => {
    expect(withSubjectInvited(withSubjectInvited(["a"], "b"), "a")).toEqual(["a", "b"]);
    expect(parseInvitedSubjects("{oups")).toEqual([]);
    expect(parseInvitedSubjects(null)).toEqual([]);
    expect(parseInvitedSubjects('[1, "x"]')).toEqual(["x"]);
  });
});

describe("les tours de l'invitation", () => {
  const memory = (initial: Record<string, string> = {}) => {
    const map = new Map(Object.entries(initial));
    return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
  };

  it("un appareil qui a vu l'ancienne invitation sans choisir la reçoit une fois de plus", () => {
    const storage = memory({ [AVATAR_INVITE_SEEN_KEY]: JSON.stringify(["damien"]) });
    expect(honorAvatarInviteRound(storage, MOBILE_AVATAR_INVITE_ROUND)).toBe(true);
    const invited = parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY));
    const context = { eligible: true, subjectId: "damien", canChangePhoto: true, online: true, busy: false, invited };
    expect(shouldInviteToAvatars({ ...context, hasPhoto: false })).toBe(true);
    // Avec une photo : jamais.
    expect(shouldInviteToAvatars({ ...context, hasPhoto: true })).toBe(false);
    // Une fois : le tour est retenu.
    storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(["damien"]));
    expect(honorAvatarInviteRound(storage, MOBILE_AVATAR_INVITE_ROUND)).toBe(false);
    expect(parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY))).toEqual(["damien"]);
  });

  it("un compte seul, sans famille ni photo : invité ; la règle ne lit rien de la Famille", () => {
    expect(shouldInviteToAvatars({ eligible: true, subjectId: "solo", canChangePhoto: true, online: true, hasPhoto: false, busy: false, invited: [] })).toBe(true);
    expect(shouldInviteToAvatars({ eligible: true, subjectId: "solo", canChangePhoto: true, online: true, hasPhoto: true, busy: false, invited: [] })).toBe(false);
  });
});
