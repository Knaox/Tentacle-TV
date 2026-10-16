import { describe, expect, it } from "vitest";
import { profileManage, rightsReachSomething } from "./familyCallers";
import { familyRightsOf } from "./familyRights";

const SWITCHES = { families: true, guests: true };
const PARENT = familyRightsOf("member", null, SWITCHES, { parent: true });
const MEMBER = familyRightsOf("member", { createGuests: false }, SWITCHES);
const CREATOR = familyRightsOf("member", { createGuests: true }, SWITCHES);

describe("profileManage : gérer depuis un profil exige un code PIN, jamais plus de droits", () => {
  it("avec un code : les droits du rôle, ni plus ni moins", () => {
    expect(profileManage(PARENT, true, 0)).toEqual({ manage: PARENT, needsPin: false });
    expect(profileManage(MEMBER, true, 1)).toEqual({ manage: MEMBER, needsPin: false });
  });

  it("sans code : rien, et le profil apprend qu'un code lui ouvrirait la gestion", () => {
    expect(profileManage(PARENT, false, 0)).toEqual({ manage: null, needsPin: true });
    expect(profileManage(CREATOR, false, 0)).toEqual({ manage: null, needsPin: true });
  });

  it("un rôle qui ne mène à aucun geste (un mineur sans droit, un membre sans invité à lui) : rien, pas même « posez un code »", () => {
    expect(profileManage(MEMBER, false, 0)).toEqual({ manage: null, needsPin: false });
    expect(profileManage(MEMBER, true, 0)).toEqual({ manage: null, needsPin: false });
    expect(rightsReachSomething(MEMBER, 0)).toBe(false);
    expect(rightsReachSomething(MEMBER, 2)).toBe(true);
    expect(rightsReachSomething(PARENT, 0)).toBe(true);
  });

  it("un invité ou le compte de démonstration ne gère rien, code ou non", () => {
    expect(profileManage(null, true, 0)).toEqual({ manage: null, needsPin: false });
    expect(profileManage(null, false, 0)).toEqual({ manage: null, needsPin: false });
  });
});
