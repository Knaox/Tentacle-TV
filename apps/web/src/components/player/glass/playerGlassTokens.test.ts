import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Les feuilles du lecteur en verre ne lisent que des jetons qui EXISTENT.
 *
 * Une variable CSS retirée ne casse rien à la compilation : la déclaration qui
 * la lit devient invalide au calcul, et une transition tombe à « aucune
 * transition » — en silence (vécu : `--lg-ease-spring`, retiré du socle,
 * figeait toutes les apparitions du lecteur).
 */

const SRC = join(__dirname, "../../..");
const HERE = __dirname;

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("les jetons du lecteur en verre", () => {
  it("toute variable --lg-* lue par les feuilles du lecteur est déclarée dans le client web", () => {
    const declared = new Set<string>();
    for (const file of cssFiles(SRC)) {
      for (const [, name] of strip(readFileSync(file, "utf8")).matchAll(/(--lg-[a-z0-9-]+)\s*:/g)) declared.add(name);
    }
    const orphans: string[] = [];
    for (const file of readdirSync(HERE).filter((n) => n.endsWith(".css"))) {
      for (const [, name] of strip(readFileSync(join(HERE, file), "utf8")).matchAll(/var\((--lg-[a-z0-9-]+)/g)) {
        if (!declared.has(name)) orphans.push(`${file} → ${name}`);
      }
    }
    expect(orphans).toEqual([]);
  });
});
