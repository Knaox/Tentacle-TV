import { describe, expect, it } from "vitest";
import { buildUserMenuItems } from "./menuItems";

const base = { t: (k: string) => k, isAdmin: false, navigate: () => undefined, handleLogout: () => undefined };

describe("le menu utilisateur", () => {
  it("ouvre sur « Mes statistiques » en ligne, puis les préférences", () => {
    const keys = buildUserMenuItems(base).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["stats", "settings"]);
  });

  it("retire les statistiques hors ligne : la route les refuse", () => {
    const keys = buildUserMenuItems({ ...base, offline: true }).map((i) => i.key);
    expect(keys).not.toContain("stats");
    expect(keys[0]).toBe("settings");
  });

  it("mène à /stats", () => {
    const visited: string[] = [];
    const stats = buildUserMenuItems({ ...base, navigate: (p) => visited.push(p) }).find((i) => i.key === "stats");
    stats?.action();
    expect(visited).toEqual(["/stats"]);
  });
});
