/**
 * SEC-F-32 — Parité HTTP / HTTPS, versant STATIQUE : aucune garde de la
 * Famille ne dépend du transport. Le serveur décide à l'identique en clair et
 * en TLS — rien ne lit le protocole de la requête, n'exige un cookie `Secure`,
 * ni n'appelle une API réservée aux contextes sécurisés.
 *
 * Le versant DYNAMIQUE (le parcours rejoué de bout en bout en HTTP puis en
 * HTTPS derrière localtest.me) est la recette de banc de la phase 4 ; ce test
 * en est le filet permanent, rejoué par la garde à chaque commit.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  let folder = process.cwd();
  while (folder !== dirname(folder)) {
    try {
      statSync(join(folder, "pnpm-workspace.yaml"));
      return folder;
    } catch {
      folder = dirname(folder);
    }
  }
  throw new Error("racine du dépôt introuvable");
}

/** Tous les .ts (hors tests) sous un dossier. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const ROOT = repoRoot();
const FAMILY_DIRS = [
  "apps/backend/src/services/family",
  "apps/backend/src/routes/family",
  "apps/backend/src/family",
];

/** Ce qui trahirait une dépendance au transport. */
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\breq(uest)?\.protocol\b/, why: "lit le protocole de la requête" },
  { pattern: /isSecureContext/, why: "exige un contexte sécurisé (navigateur)" },
  { pattern: /x-forwarded-proto/i, why: "décide selon le protocole relayé" },
  { pattern: /\bsecure\s*:\s*true\b/, why: "impose un cookie Secure" },
  { pattern: /crypto\.subtle/, why: "API réservée aux contextes sécurisés" },
  { pattern: /\bwindow\.isSecureContext\b/, why: "contexte sécurisé navigateur" },
];

describe("SEC-F-32 : la Famille ne dépend jamais du transport (HTTP = HTTPS)", () => {
  const files = FAMILY_DIRS.flatMap((d) => sources(join(ROOT, d)));

  it("couvre bien les sources de la Famille", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)("aucune source ne $why", ({ pattern }) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});
