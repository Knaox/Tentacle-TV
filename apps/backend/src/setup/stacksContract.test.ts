/**
 * Les piles Docker livrées (`stacks/`) et le Dockerfile, relus comme des
 * contrats : jamais le socket Docker, jamais un mot de passe écrit, jamais
 * root pour Tentacle, et chaque pile dit à Tentacle ce qu'elle est. Depuis
 * 1.25, DEUX piles et aucune base de données : Tentacle garde ses données dans
 * un fichier SQLite de son volume.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
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
/** Le dossier → la valeur de `TENTACLE_STACK` (contrat `SetupStack` : aucune valeur nouvelle). */
const STACKS = { "tentacle-full": "full", "tentacle-only": "only" } as const;
const read = (path: string) => readFileSync(join(root, path), "utf8");
/** Le texte utile : les lignes de commentaire ôtées (elles peuvent CITER ce qu'il ne faut pas faire). */
const code = (text: string) => text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
/** Les blocs des services (`services:` → une entrée indentée de deux espaces chacune). */
function serviceBlocks(text: string): string[] {
  const services = text.split(/^services:\s*$/m)[1]?.split(/^\S/m)[0] ?? "";
  return services.split(/^ {2}(?=[A-Za-z0-9_-]+:\s*$)/m).filter((block) => block.trim());
}

describe("les piles Docker livrées", () => {
  for (const [stack, kind] of Object.entries(STACKS)) {
    describe(stack, () => {
      const compose = read(`stacks/${stack}/compose.yaml`);

      it("ne monte jamais le socket Docker", () => {
        expect(compose).not.toContain("docker.sock");
      });

      it("n'écrit aucun secret", () => {
        expect(code(compose)).not.toMatch(/PASSWORD|JWT_SECRET/i);
      });

      it("1.25 : aucune base de données — ni service MariaDB / MySQL, ni init, ni secrets, ni variable de base", () => {
        const blocks = serviceBlocks(code(compose));
        expect(blocks.some((block) => /image:\s*(mariadb|mysql)\b/.test(block))).toBe(false);
        expect(blocks.some((block) => /^(db|init):/.test(block))).toBe(false);
        expect(code(compose)).not.toMatch(/DB_HOST|DB_PASSWORD_FILE|DATABASE_URL|MARIADB_|tentacle-secrets|tentacle-db\b/);
      });

      it("dit à Tentacle quelle pile il est, et le port de l'hôte pour son lien d'installation", () => {
        expect(code(compose)).toContain(`TENTACLE_STACK: ${kind}`);
        expect(compose).toContain("TENTACLE_HOST_PORT:");
      });

      it("garde le volume des données sous son nom et son chemin : une pile d'avant remplacée dans le même dossier les reprend", () => {
        expect(code(compose)).toMatch(/^ {6}- tentacle-data:\/app\/apps\/backend\/data$/m);
        expect(code(compose)).toMatch(/^volumes:\n(?: {2}[a-z-]+:\n)*? {2}tentacle-data:/m);
        // Un `name:` en tête changerait le projet, donc le nom réel des volumes.
        expect(code(compose)).not.toMatch(/^name:/m);
      });

      it("laisse l'image démarrer Tentacle (tini, puis l'utilisateur PUID:PGID), et l'interface web réglable", () => {
        const tentacle = serviceBlocks(code(compose)).find((block) => block.startsWith("tentacle:"))!;
        expect(tentacle).not.toMatch(/^\s*(entrypoint|user|command):/m);
        expect(compose).toContain('# TENTACLE_WEB_UI: "off"');
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

  it("pile complète : SON Jellyfin est désigné à Tentacle (mis en tête et choisi d'office par l'assistant), ses volumes gardent leurs noms", () => {
    const text = code(read("stacks/tentacle-full/compose.yaml"));
    const tentacle = serviceBlocks(text).find((block) => block.startsWith("tentacle:"))!;
    expect(tentacle).toContain("JELLYFIN_INTERNAL_URL: http://jellyfin:8096");
    expect(tentacle).toMatch(/jellyfin:\s*\n\s*condition: service_started/);
    expect(text).toMatch(/^ {6}- jellyfin-config:\/config$/m);
    expect(text).toMatch(/^ {6}- jellyfin-cache:\/cache$/m);
  });

  it("pile seule : un Jellyfin de la machine se joint par host.docker.internal", () => {
    const tentacle = serviceBlocks(code(read("stacks/tentacle-only/compose.yaml"))).find((block) => block.startsWith("tentacle:"))!;
    expect(tentacle).toContain('"host.docker.internal:host-gateway"');
    expect(tentacle).not.toMatch(/JELLYFIN_INTERNAL_URL/);
  });

  it("1.25 : deux piles, pas une de plus, et plus aucun compose à la racine du dépôt", () => {
    const stacks = readdirSync(join(root, "stacks"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, "stacks", entry.name, "compose.yaml")))
      .map((entry) => entry.name)
      .sort();
    expect(stacks).toEqual(Object.keys(STACKS).sort());
    expect(readdirSync(root).filter((name) => /^(docker-)?compose[\w.-]*\.ya?ml$/.test(name))).toEqual([]);
  });

  it("le Dockerfile ne parle pas de socket Docker", () => {
    expect(code(read("Dockerfile"))).not.toContain("docker.sock");
  });
});
