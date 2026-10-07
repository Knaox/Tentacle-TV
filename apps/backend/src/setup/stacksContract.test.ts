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
/** Les blocs des services (`services:` → une entrée indentée de deux espaces chacune). */
function serviceBlocks(text: string): string[] {
  const services = text.split(/^services:\s*$/m)[1]?.split(/^\S/m)[0] ?? "";
  return services.split(/^ {2}(?=[A-Za-z0-9_-]+:\s*$)/m).filter((block) => block.trim());
}

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

      it("ne donne à Tentacle aucun réglage des médias : seul Jellyfin monte ses dossiers", () => {
        const tentacleServices = serviceBlocks(code(compose)).filter((block) => /image:\s*ghcr\.io\/knaox\/tentacle-tv/.test(block));
        expect(tentacleServices.length).toBeGreaterThan(0);
        for (const block of tentacleServices) {
          expect(block).not.toMatch(/:\/media\b/);
          expect(block).not.toMatch(/MEDIA_PATH|TENTACLE_MEDIA/);
        }
      });

      it("n'embarque aucun mandataire : l'utilisateur garde le sien (docs/server/remote-access.md)", () => {
        expect(code(compose)).not.toMatch(/image:\s*(caddy|traefik|nginx|jc21\/nginx-proxy-manager)\b/);
        expect(code(compose)).not.toMatch(/^\s*profiles:/m);
        expect(code(compose)).not.toMatch(/:(80|443)"/);
      });
    });
  }

  it("pile complète : Jellyfin garde son dossier des médias, et films / series naissent de son côté", () => {
    const blocks = serviceBlocks(code(read("stacks/tentacle-full/compose.yaml")));
    const jellyfin = blocks.find((block) => block.startsWith("jellyfin:"));
    const jellyfinInit = blocks.find((block) => block.startsWith("jellyfin-init:"));
    expect(jellyfin).toMatch(/\$\{MEDIA_PATH:-\.\/media\}:\/media/);
    expect(jellyfinInit).toMatch(/image:\s*jellyfin\/jellyfin/);
    expect(jellyfinInit).toMatch(/\$\{MEDIA_PATH:-\.\/media\}:\/media/);
    expect(jellyfin).toMatch(/jellyfin-init:\s*\n\s*condition: service_completed_successfully/);
  });

  it("le Dockerfile ne parle pas de socket Docker", () => {
    expect(code(read("Dockerfile"))).not.toContain("docker.sock");
  });
});
