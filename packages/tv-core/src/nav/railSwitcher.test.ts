import { describe, expect, it } from "vitest";
import { railSwitcherSummary } from "./railSwitcher";

const p = (id: string) => ({ id, name: id });

describe("railSwitcherSummary — la photo du profil connecté et « +N »", () => {
  it("le profil connecté, et les autres profils comptés", () => {
    const family = [p("owner"), p("member"), p("guest")];
    expect(railSwitcherSummary(family, "member")).toEqual({ current: family[1], others: 2, badge: "+2" });
  });

  it("seul sur la TV : la photo, sans pastille", () => {
    const alone = [p("owner")];
    expect(railSwitcherSummary(alone, "owner")).toEqual({ current: alone[0], others: 0, badge: null });
  });

  it("profil connecté absent de la liste (pas encore lue, ou retiré) : la pastille compte tout", () => {
    expect(railSwitcherSummary([p("a"), p("b")], "gone")).toEqual({ current: null, others: 2, badge: "+2" });
    expect(railSwitcherSummary([p("a")], null)).toEqual({ current: null, others: 1, badge: "+1" });
    expect(railSwitcherSummary([], "a")).toEqual({ current: null, others: 0, badge: null });
  });

  it("une très grande famille garde une pastille courte", () => {
    const many = Array.from({ length: 150 }, (_, n) => p(`u${n}`));
    expect(railSwitcherSummary(many, "u0").badge).toBe("+99");
  });
});
