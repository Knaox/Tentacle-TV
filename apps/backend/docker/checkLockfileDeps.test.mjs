// Le contrôle « dépendances de l'image = verrou » (check-lockfile-deps.mjs),
// sur un verrou miniature puis sur le vrai pnpm-lock.yaml du dépôt.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  compare,
  dropOptionalPeers,
  parseLockfile,
  productionClosure,
  staleSpecifiers,
} from "./check-lockfile-deps.mjs";

const LOCK = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  apps/server:
    dependencies:
      '@scope/web':
        specifier: ^1.0.0
        version: 1.2.0
      client:
        specifier: ^2.0.0
        version: 2.0.0(cli@3.0.0)
    devDependencies:
      vitest:
        specifier: ^3.0.0
        version: 3.0.0

packages:

  '@scope/web@1.2.0':
    resolution: {integrity: sha512-a}

  cli@3.0.0:
    resolution: {integrity: sha512-b}

  client@2.0.0:
    resolution: {integrity: sha512-c}
    peerDependencies:
      cli: '*'
    peerDependenciesMeta:
      cli:
        optional: true

  engine@1.0.0:
    resolution: {integrity: sha512-d}

  native-linux@1.0.0:
    resolution: {integrity: sha512-e}
    os: [linux]

  tiny@1.0.0:
    resolution: {integrity: sha512-f}

  vitest@3.0.0:
    resolution: {integrity: sha512-g}

snapshots:

  '@scope/web@1.2.0':
    dependencies:
      tiny: 1.0.0
    optionalDependencies:
      native-linux: 1.0.0

  cli@3.0.0:
    dependencies:
      engine: 1.0.0

  client@2.0.0(cli@3.0.0):
    optionalDependencies:
      cli: 3.0.0

  engine@1.0.0: {}

  native-linux@1.0.0:
    optional: true

  tiny@1.0.0: {}

  vitest@3.0.0: {}
`;

const lock = parseLockfile(LOCK);
const dirs = [];

/** Un node_modules à plat : { "nom": "version", "parent/node_modules/nom": "version" }. */
function nodeModules(tree) {
  const root = mkdtempSync(join(tmpdir(), "lockdeps-"));
  dirs.push(root);
  for (const [path, version] of Object.entries(tree)) {
    const dir = join(root, path);
    mkdirSync(dir, { recursive: true });
    const name = path.split("/node_modules/").pop();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
  }
  return root;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("lecture du verrou", () => {
  it("lit versions, spécificateurs, pairs et snapshots", () => {
    expect(lock.importers["apps/server"].dependencies).toEqual({
      "@scope/web": "1.2.0",
      client: "2.0.0(cli@3.0.0)",
    });
    expect(lock.specifiers["apps/server"].dependencies.client).toBe("^2.0.0");
    expect([...lock.packages.get("client@2.0.0").peers]).toEqual(["cli"]);
    expect(lock.snapshots["cli@3.0.0"].dependencies).toEqual({ engine: "1.0.0" });
  });

  it("sépare le requis, le facultatif et les pairs facultatifs — jamais les dépendances de dev", () => {
    const { required, allowed, optionalPeers } = productionClosure(lock, "apps/server");
    expect([...required].sort()).toEqual(["@scope/web@1.2.0", "client@2.0.0", "tiny@1.0.0"]);
    expect(allowed.has("native-linux@1.0.0")).toBe(true);
    expect([...optionalPeers].sort()).toEqual(["cli@3.0.0", "engine@1.0.0"]);
    expect(allowed.has("vitest@3.0.0")).toBe(false);
  });
});

describe("comparaison d'un node_modules au verrou", () => {
  const exact = { "@scope/web": "1.2.0", client: "2.0.0", tiny: "1.0.0", "native-linux": "1.0.0" };

  it("conforme : aucun écart", () => {
    expect(compare(lock, "apps/server", nodeModules(exact)).problems).toEqual([]);
  });

  it("une plateforme sans son binaire facultatif reste conforme", () => {
    const { "native-linux": _, ...rest } = exact;
    expect(compare(lock, "apps/server", nodeModules(rest)).problems).toEqual([]);
  });

  it("une version résolue à neuf (le défaut du deploy --legacy) : version, inconnu, manquant", () => {
    const kinds = compare(lock, "apps/server", nodeModules({ ...exact, client: "2.4.1" })).problems.map(
      (p) => `${p.kind} ${p.id}`,
    );
    expect(kinds).toEqual(["inconnu client@2.4.1", "version client 2.4.1 ≠ 2.0.0", "manquant client@2.0.0"]);
  });

  it("une copie imbriquée hors verrou est vue aussi", () => {
    const tree = { ...exact, "@scope/web/node_modules/tiny": "1.9.9" };
    const problems = compare(lock, "apps/server", nodeModules(tree)).problems;
    expect(problems.map((p) => `${p.kind} ${p.id}`)).toEqual(["inconnu tiny@1.9.9"]);
  });

  it("un paquet du verrou hors de la production (dev) est en trop", () => {
    const problems = compare(lock, "apps/server", nodeModules({ ...exact, vitest: "3.0.0" })).problems;
    expect(problems.map((p) => `${p.kind} ${p.id}`)).toEqual(["en trop vitest@3.0.0"]);
  });

  it("les pairs facultatifs sont en trop tant qu'on ne les retire pas, puis retirés seuls", () => {
    const root = nodeModules({ ...exact, cli: "3.0.0", engine: "1.0.0" });
    expect(compare(lock, "apps/server", root).problems.map((p) => p.kind)).toEqual(["en trop", "en trop"]);
    const dropped = dropOptionalPeers(lock, "apps/server", root);
    expect(dropped.map((p) => p.name).sort()).toEqual(["cli", "engine"]);
    expect(compare(lock, "apps/server", root).problems).toEqual([]);
  });
});

describe("verrou périmé", () => {
  const manifest = { dependencies: { "@scope/web": "^1.0.0", client: "^2.0.0" }, devDependencies: { x: "1" } };

  it("à jour : rien", () => {
    expect(staleSpecifiers(lock, "apps/server", manifest)).toEqual([]);
  });

  it("une dépendance ajoutée ou une plage changée sans `pnpm install`", () => {
    const changed = { dependencies: { "@scope/web": "^1.3.0", client: "^2.0.0", added: "^1.0.0" } };
    expect(staleSpecifiers(lock, "apps/server", changed).map((p) => p.id)).toEqual([
      "dependencies.@scope/web : package.json ^1.3.0, verrou ^1.0.0",
      "dependencies.added : package.json ^1.0.0, verrou —",
    ]);
  });
});

describe("le vrai verrou du dépôt", () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const real = parseLockfile(readFileSync(join(repo, "pnpm-lock.yaml"), "utf8"));
  const backend = JSON.parse(readFileSync(join(repo, "apps/backend/package.json"), "utf8"));

  it("est à jour pour le serveur", () => {
    expect(staleSpecifiers(real, "apps/backend", backend)).toEqual([]);
  });

  it("chaque dépendance directe du serveur est dans sa fermeture de production", () => {
    const { required } = productionClosure(real, "apps/backend");
    for (const [name, ref] of Object.entries(real.importers["apps/backend"].dependencies)) {
      expect(required.has(`${name}@${ref.replace(/\(.*$/, "")}`)).toBe(true);
    }
  });

  it("la CLI prisma et typescript n'y entrent que comme pairs facultatifs", () => {
    const { required, optionalPeers } = productionClosure(real, "apps/backend");
    const names = (set) => [...set].map((id) => id.slice(0, id.lastIndexOf("@")));
    expect(names(optionalPeers)).toEqual(expect.arrayContaining(["prisma", "typescript"]));
    expect(names(required)).not.toContain("prisma");
    expect(names(required)).not.toContain("typescript");
  });
});
