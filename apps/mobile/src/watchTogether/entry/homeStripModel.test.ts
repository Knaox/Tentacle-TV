import { describe, expect, it } from "vitest";
import { homeStripKind, type HomeStripInput } from "./homeStripModel";

const none: HomeStripInput = {
  inGroup: false, groupItemId: null, affinityInvite: false, inviteCount: 0, elsewhere: false, elsewhereDismissed: false,
};

describe("homeStripKind", () => {
  it("rien quand il n'y a rien", () => {
    expect(homeStripKind(none)).toBeNull();
  });
  it("en salle : l'affinité d'abord, puis la lecture, puis le groupe", () => {
    expect(homeStripKind({ ...none, inGroup: true, groupItemId: "i", affinityInvite: true })).toBe("affinity");
    expect(homeStripKind({ ...none, inGroup: true, groupItemId: "i" })).toBe("playing");
    expect(homeStripKind({ ...none, inGroup: true })).toBe("group");
  });
  it("hors salle : les invitations avant l'autre appareil", () => {
    expect(homeStripKind({ ...none, inviteCount: 2, elsewhere: true })).toBe("invites");
    expect(homeStripKind({ ...none, elsewhere: true })).toBe("elsewhere");
    expect(homeStripKind({ ...none, elsewhere: true, elsewhereDismissed: true })).toBeNull();
  });
});
