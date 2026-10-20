import { describe, expect, it } from "vitest";
import { avatarInviteSubject } from "./avatarInviteSubject";
import { shouldInviteToAvatars } from "./avatarInvite";

const base = { accountId: "damien", accountHasPhoto: true, profile: null, listed: undefined, devicePhoto: true };

describe("le sujet de l'invitation aux avatars", () => {
  it("en session personnelle : le compte, sa photo d'après Jellyfin", () => {
    expect(avatarInviteSubject(base)).toEqual({ subjectId: "damien", hasPhoto: true, canChangePhoto: true });
    expect(avatarInviteSubject({ ...base, accountHasPhoto: undefined }).hasPhoto).toBeUndefined();
  });

  it("en session de profil sans photo : le profil est invité, même si le compte en a une (le cas de l'alpha)", () => {
    const subject = avatarInviteSubject({ ...base, accountHasPhoto: undefined, profile: { id: "zoe", imageTag: null } });
    expect(subject).toEqual({ subjectId: "zoe", hasPhoto: false, canChangePhoto: true });
    expect(shouldInviteToAvatars({ eligible: true, ...subject, online: true, busy: false, invited: ["damien"] })).toBe(true);
    // Une fois par sujet et par appareil.
    expect(shouldInviteToAvatars({ eligible: true, ...subject, online: true, busy: false, invited: ["zoe"] })).toBe(false);
  });

  it("la liste du serveur l'emporte sur la marque (photo posée ailleurs depuis le choix)", () => {
    const profile = { id: "zoe", imageTag: null };
    expect(avatarInviteSubject({ ...base, profile, listed: [{ userId: "lea", imageTag: "t1" }] }).hasPhoto).toBe(false);
    expect(avatarInviteSubject({ ...base, profile, listed: [{ userId: "ZO-E", imageTag: "t1" }] }).hasPhoto).toBe(true);
    expect(avatarInviteSubject({ ...base, profile: { id: "zoe", imageTag: "t0" }, listed: [] }).hasPhoto).toBe(true);
  });

  it("un serveur qui ne sait pas poser la photo d'un profil par l'appareil : pas d'invitation", () => {
    const subject = avatarInviteSubject({ ...base, profile: { id: "zoe", imageTag: null }, devicePhoto: false });
    expect(subject.canChangePhoto).toBe(false);
    expect(shouldInviteToAvatars({ eligible: true, ...subject, online: true, busy: false, invited: [] })).toBe(false);
  });
});
