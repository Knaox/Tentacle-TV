import { describe, expect, it } from "vitest";
import { isConfigWrite, isNavigationWrite } from "./pluginNavigationWrite";

describe("écriture de la navigation par une extension", () => {
  const route = "/navigation";

  it("un PUT réussi sur SA route : la barre se relit", () => {
    expect(isNavigationWrite({ method: "PUT", path: "/api/plugins/ext/navigation" }, 200, "ext", route)).toBe(true);
    expect(isNavigationWrite({ method: "put", path: "/api/plugins/ext/navigation?x=1" }, 204, "ext", route)).toBe(true);
  });

  it("une lecture, un refus, une autre route ou une autre extension : rien", () => {
    expect(isNavigationWrite({ method: "GET", path: "/api/plugins/ext/navigation" }, 200, "ext", route)).toBe(false);
    expect(isNavigationWrite({ path: "/api/plugins/ext/navigation" }, 200, "ext", route)).toBe(false);
    expect(isNavigationWrite({ method: "PUT", path: "/api/plugins/ext/navigation" }, 403, "ext", route)).toBe(false);
    expect(isNavigationWrite({ method: "PUT", path: "/api/plugins/ext/admin/settings" }, 200, "ext", route)).toBe(false);
    expect(isNavigationWrite({ method: "PUT", path: "/api/plugins/autre/navigation" }, 200, "ext", route)).toBe(false);
  });

  it("une extension qui ne déclare rien (serveur d'avant) : rien", () => {
    expect(isNavigationWrite({ method: "PUT", path: "/api/plugins/ext/navigation" }, 200, "ext", undefined)).toBe(false);
  });
});

describe("écriture de sa configuration par une extension (activer, couper)", () => {
  it("un PUT réussi sur SA config : les extensions se relisent ; une lecture, un refus, une autre : rien", () => {
    expect(isConfigWrite({ method: "PUT", path: "/api/plugins/ext/config" }, 200, "ext")).toBe(true);
    expect(isConfigWrite({ method: "GET", path: "/api/plugins/ext/config" }, 200, "ext")).toBe(false);
    expect(isConfigWrite({ method: "PUT", path: "/api/plugins/ext/config" }, 403, "ext")).toBe(false);
    expect(isConfigWrite({ method: "PUT", path: "/api/plugins/autre/config" }, 200, "ext")).toBe(false);
  });
});
