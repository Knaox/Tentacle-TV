import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appLayout, argValue, manifestVersion, resolveAppRoot } from "./appLayout";
import { refreshSharedDeps } from "./data/sharedDeps";

describe("racine de l'application", () => {
  it("vaut trois crans au-dessus de dist/main.js par défaut", () => {
    const hostDir = resolve("/app/apps/server-windows/dist");
    expect(resolveAppRoot([], {}, hostDir)).toBe(resolve("/app"));
  });

  it("cède à --app-root, puis à TENTACLE_APP_ROOT", () => {
    expect(resolveAppRoot(["node", "main.js", "--app-root", "/x"], { TENTACLE_APP_ROOT: "/y" }, "/h")).toBe(resolve("/x"));
    expect(resolveAppRoot([], { TENTACLE_APP_ROOT: "/y" }, "/h")).toBe(resolve("/y"));
    expect(argValue(["--app-root", "--other"], "--app-root")).toBeNull();
  });
});

describe("appLayout et shared-deps", () => {
  let root = "";
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("reproduit /app, et prend la semence de l'image avant celle du dépôt", () => {
    root = mkdtempSync(join(tmpdir(), "host-app-"));
    mkdirSync(join(root, "apps", "backend", "data", "shared-deps"), { recursive: true });
    expect(appLayout(root).sharedDepsSeed).toBe(join(root, "apps", "backend", "data", "shared-deps"));
    mkdirSync(join(root, "shared-deps-seed"));
    const layout = appLayout(root);
    expect(layout.sharedDepsSeed).toBe(join(root, "shared-deps-seed"));
    expect(layout.serverEntry).toBe(join(root, "apps", "backend", "dist", "index.js"));
    expect(layout.python).toBeNull();
    expect(layout.cliEntry).toBe(join(root, "apps", "backend", "dist", "cli", "tentacle.js"));
    expect(layout.packageVersion).toBeNull();
  });

  it("lit sa version dans le manifeste du paquet, sans le 4e champ", () => {
    root = mkdtempSync(join(tmpdir(), "host-manifest-"));
    writeFileSync(
      join(root, "AppxManifest.xml"),
      '<?xml version="1.0"?><Package><Identity Name="A.B" Publisher="CN=x" Version="1.4.2.0" /><Dependencies Version="9.9.9.9"/></Package>',
    );
    expect(appLayout(root).packageVersion).toBe("1.4.2");
    expect(manifestVersion("<Package/>")).toBeNull();
  });

  it("recopie les fichiers de premier niveau de la semence", () => {
    root = mkdtempSync(join(tmpdir(), "host-deps-"));
    const seed = join(root, "seed");
    mkdirSync(join(seed, "sub"), { recursive: true });
    writeFileSync(join(seed, "shared-deps.js"), "a");
    writeFileSync(join(seed, "tailwind.js"), "b");
    expect(refreshSharedDeps(seed, join(root, "data", "shared-deps"))).toBe(2);
    expect(readdirSync(join(root, "data", "shared-deps")).sort()).toEqual(["shared-deps.js", "tailwind.js"]);
    expect(refreshSharedDeps(null, join(root, "x"))).toBeNull();
  });
});
