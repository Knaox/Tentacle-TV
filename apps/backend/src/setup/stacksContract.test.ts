/**
 * Les piles Docker livrées (`stacks/`) et le Dockerfile, relus comme des
 * contrats : jamais le socket Docker, jamais un mot de passe écrit, jamais
 * root pour Tentacle, et chaque pile dit à Tentacle ce qu'elle est.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

const root = repoRoot();
const STACKS = ["tentacle-full", "tentacle-db", "tentacle-only"] as const;
const read = (path: string) => readFileSync(join(root, path), "utf8");
/** Le texte utile : les lignes de commentaire ôtées (elles peuvent CITER ce qu'il ne faut pas faire). */
const code = (text: string) => text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");

describe("les piles Docker livrées", () => {
  for (const stack of STACKS) {
    describe(stack, () => {
      const compose = read(`stacks/${stack}/compose.yaml`);

      it("ne monte jamais le socket Docker", () => {
        expect(compose).not.toContain("docker.sock");
      });

      it("n'écrit aucun mot de passe : la base lit ses secrets dans un fichier généré", () => {
        expect(code(compose)).not.toMatch(/PASSWORD\s*:\s*(?!\/run\/tentacle-secrets)[^\s$][^\n]*/i);
        expect(code(compose)).not.toMatch(/JWT_SECRET/);
      });

      it("dit à Tentacle quelle pile il est, et le port de l'hôte pour son lien d'installation", () => {
        expect(compose).toContain(`TENTACLE_STACK: ${stack.replace("tentacle-", "")}`);
        expect(compose).toContain("TENTACLE_HOST_PORT:");
      });

      it("fait tourner Tentacle sous PUID:PGID, jamais root", () => {
        expect(compose).toMatch(/PUID: \$\{PUID:-1000\}/);
      });
    });
  }

  it("le Dockerfile ne parle pas de socket Docker", () => {
    expect(code(read("Dockerfile"))).not.toContain("docker.sock");
  });
});
