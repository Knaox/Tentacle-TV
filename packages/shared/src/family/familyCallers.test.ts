import { describe, expect, it } from "vitest";
import { profileManage } from "./familyCallers";
import { familyRightsOf } from "./familyRights";

const SWITCHES = { families: true, guests: true };
const PARENT = familyRightsOf("member", null, SWITCHES, { parent: true });
const MEMBER = familyRightsOf("member", { createGuests: false }, SWITCHES);

describe("profileManage : gérer depuis un profil exige un code PIN, jamais plus de droits", () => {
  it("avec un code : les droits du rôle, ni plus ni moins", () => {
    expect(profileManage(PARENT, true)).toEqual({ manage: PARENT, needsPin: false });
    expect(profileManage(MEMBER, true)).toEqual({ manage: MEMBER, needsPin: false });
  });

  it("sans code : rien, et le profil apprend qu'un code lui ouvrirait la gestion", () => {
    expect(profileManage(PARENT, false)).toEqual({ manage: null, needsPin: true });
  });

  it("un invité ou le compte de démonstration ne gère rien, code ou non", () => {
    expect(profileManage(null, true)).toEqual({ manage: null, needsPin: false });
    expect(profileManage(null, false)).toEqual({ manage: null, needsPin: false });
  });
});
