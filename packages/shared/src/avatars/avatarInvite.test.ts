import { describe, expect, it } from "vitest";
import { parseInvitedSubjects, shouldInviteToAvatars, withSubjectInvited, type AvatarInviteContext } from "./avatarInvite";

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
