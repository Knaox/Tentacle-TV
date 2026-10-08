import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

/**
 * Les dépendances de production de l'IMAGE sont celles du verrou, et seulement
 * elles (audit du chantier SQLite, constat D2) : un `pnpm deploy --legacy`
 * résolvait tout à neuf depuis le registre à chaque build — des versions jamais
 * testées ni relues partaient en production. Ce garde relit le Dockerfile :
 * l'étape « prod-deps » installe le verrou figé, puis le contrôle
 * `check-lockfile-deps.mjs` compare chaque paquet installé au verrou, AVANT
 * l'élagage. Retirer l'un ou l'autre fait échouer ce test.
 */
const ROOT = resolve(__dirname, "../../../..");
const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf8");

/** Les instructions d'une étape (`FROM … AS <nom>`), lignes continuées recollées, sans commentaires. */
function stage(name: string): string[] {
  const lines = dockerfile.replace(/\\\n\s*/g, " ").split("\n").filter((line) => !/^\s*#/.test(line));
  const start = lines.findIndex((line) => new RegExp(`^FROM\\s+\\S+\\s+AS\\s+${name}\\s*$`, "i").test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^FROM\s/i.test(line));
  return lines.slice(start, end < 0 ? undefined : end);
}

describe("image : les dépendances du serveur suivent le verrou", () => {
  const prodDeps = stage("prod-deps");
  const deploy = prodDeps.find((line) => /\bpnpm\b.*\bdeploy\b/.test(line)) ?? "";
  const checkIndex = prodDeps.findIndex((line) => /node\s+\S*check-lockfile-deps\.mjs\b/.test(line));
  const pruneIndex = prodDeps.findIndex((line) => /prune-node-modules\.sh\s+\/deploy/.test(line));

  it("l'étape prod-deps existe et déploie le serveur", () => {
    expect(prodDeps.length).toBeGreaterThan(0);
    expect(deploy).toMatch(/--filter\s+@tentacle-tv\/backend/);
  });

  it("le deploy lit le verrou figé, jamais en « legacy »", () => {
    expect(deploy).toMatch(/--frozen-lockfile\b/);
    expect(deploy).not.toMatch(/--legacy\b/);
    expect(deploy).not.toMatch(/--no-frozen-lockfile|--fix-lockfile|--no-lockfile/);
  });

  it("le verrou et .npmrc (disposition « hoisted ») sont copiés dans l'étape", () => {
    expect(prodDeps.some((line) => /^COPY\b.*\bpnpm-lock\.yaml\b/.test(line))).toBe(true);
    expect(prodDeps.some((line) => /^COPY\b.*\.npmrc\b/.test(line))).toBe(true);
  });

  it("chaque paquet installé est comparé au verrou, après le deploy et AVANT l'élagage", () => {
    const deployIndex = prodDeps.indexOf(deploy);
    expect(checkIndex).toBeGreaterThan(deployIndex);
    expect(pruneIndex).toBeGreaterThan(checkIndex);
    expect(prodDeps[checkIndex]).toMatch(/pnpm-lock\.yaml\s+apps\/backend\s+\/deploy\/node_modules/);
  });
});
