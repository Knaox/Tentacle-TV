import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY, shouldInviteToAvatars } from "@tentacle-tv/shared";
import { inviteBusy, inviteOnPlayer, markSubjectInvited, readInvitedSubjects, type InviteBusyContext } from "./inviteGate";

const calm: InviteBusyContext = {
  overlaysQuiet: true,
  pathname: "/",
  rootSegment: "(tabs)",
  appActive: true,
  galleryOpen: false,
};

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("l'invitation aux avatars sur le mobile", () => {
  it("vient sur l'accueil calme, juste après la connexion comme à un lancement", () => {
    expect(inviteBusy(calm)).toBe(false);
    expect(inviteBusy({ ...calm, pathname: "/for-you" })).toBe(false);
  });

  it("jamais par-dessus un recouvrement, le lecteur, la connexion, une fenêtre du système, ni elle-même", () => {
    expect(inviteBusy({ ...calm, overlaysQuiet: false })).toBe(true);
    expect(inviteBusy({ ...calm, pathname: "/watch/abc", rootSegment: "watch" })).toBe(true);
    expect(inviteBusy({ ...calm, pathname: "/login", rootSegment: "(auth)" })).toBe(true);
    expect(inviteBusy({ ...calm, appActive: false })).toBe(true);
    expect(inviteBusy({ ...calm, galleryOpen: true })).toBe(true);
  });

  it("une fois par compte et par appareil, sous la clé partagée", () => {
    const storage = memoryStorage();
    expect(readInvitedSubjects(storage)).toEqual([]);
    const invited = markSubjectInvited(storage, "u1");
    expect(invited).toEqual(["u1"]);
    expect(storage.getItem(AVATAR_INVITE_SEEN_KEY)).toBe('["u1"]');
    const rule = { eligible: true, canChangePhoto: true, online: true, hasPhoto: false, busy: false };
    expect(shouldInviteToAvatars({ ...rule, subjectId: "u1", invited: readInvitedSubjects(storage) })).toBe(false);
    expect(shouldInviteToAvatars({ ...rule, subjectId: "u2", invited: readInvitedSubjects(storage) })).toBe(true);
  });

  it("la clé est préchargée au lancement — sinon l'invitation reviendrait à chaque ouverture", () => {
    // La liste FERMÉE de `RNStorageAdapter` : une clé absente s'écrit, mais ne se relit jamais.
    const adapter = readFileSync(resolve(__dirname, "../../storage/RNStorageAdapter.ts"), "utf8");
    expect(adapter).toContain(`"${AVATAR_INVITE_SEEN_KEY}",`);
  });

  it("une valeur abîmée vaut « personne »", () => {
    expect(readInvitedSubjects(memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: "{oups" }))).toEqual([]);
  });
});

describe("jamais sur le lecteur", () => {
  it("le lecteur à l'écran : la galerie ne se présente pas (elle reviendra au retour)", () => {
    expect(inviteOnPlayer({ pathname: "/watch/abc", rootSegment: "watch" })).toBe(true);
    expect(inviteOnPlayer({ pathname: "/", rootSegment: "(tabs)" })).toBe(false);
  });
});
