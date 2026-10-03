/**
 * Le contrat de `GET /api/admin/server-update` : la version du serveur en
 * service, la dernière publiée (Releases `server-vX.Y.Z` du dépôt, lues par le
 * serveur et gardées six heures — jamais un appel GitHub par affichage), ce
 * que les clients publiés exigent, et ce que le serveur sait de son
 * installation sans parler à Docker.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/services/serverUpdate/serverUpdateContract.ts` (le backend
 * ne dépend pas de `@tentacle-tv/shared`). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/serverUpdate/serverUpdateContract.ts apps/backend/src/services/serverUpdate/
 *
 * `serverUpdateMirror.test.ts` (backend) refuse toute divergence. Aucun
 * import : le fichier doit compiler seul des deux côtés.
 */

/** L'image officielle du serveur — celle de `docker-compose.yml` et du README. */
export const SERVER_IMAGE_REPOSITORY = "ghcr.io/knaox/tentacle-tv";

/** Une publication du serveur, telle que la carte « Serveur Tentacle » la montre. */
export interface ServerRelease {
  /** « 1.22.4 » : sans le préfixe du tag. */
  version: string;
  /** « server-v1.22.4 ». */
  tag: string;
  publishedAt: string | null;
  /** Les notes complètes, sur GitHub — construites par le serveur, jamais reçues telles quelles. */
  url: string;
  /** L'essentiel des nouveautés : les premiers titres des notes, dans leurs deux langues. */
  highlights: { fr: string[]; en: string[] };
}

/**
 * Comment le serveur tourne, tel qu'il le sait de lui-même — sans socket ni
 * API du démon Docker (décision du 2026-10-03).
 */
export interface ServerInstall {
  /** `docker` / `podman` : dans un conteneur ; `none` : lancé à même la machine (développement). */
  runtime: "docker" | "podman" | "none";
  /** Le dépôt de l'image : l'officiel, sauf si l'installation en déclare un autre (`TENTACLE_IMAGE`). */
  repository: string;
  /**
   * L'étiquette, connue seulement si l'installation la déclare
   * (`TENTACLE_IMAGE=ghcr.io/knaox/tentacle-tv:v1.22.3`) : une même image
   * porte `:latest` ET `:vX.Y.Z`, rien en elle ne dit laquelle a été tirée.
   */
  tag: string | null;
}

/** Pourquoi la dernière publication n'est pas connue (ou plus à jour). */
export type ServerUpdateCheckError = "unreachable" | "rate-limited" | "invalid" | "off";

export interface ServerUpdateReport {
  /** La version en service. */
  current: string;
  /** Un identifiant par processus : il change à chaque redémarrage du serveur. */
  bootId: string;
  /** `null` : jamais lue (hors ligne, vérification coupée). */
  latest: ServerRelease | null;
  /** Les versions publiées depuis celle en service, la dernière comprise (0 : à jour). */
  behind: number;
  /** La version minimale que les clients publiés exigent du serveur (`minServer`), si connue. */
  requiredByClients: string | null;
  /** Dernière lecture RÉUSSIE de GitHub. */
  checkedAt: string | null;
  /** La dernière tentative a échoué — ce qui est montré date alors de `checkedAt`. */
  error: ServerUpdateCheckError | null;
  install: ServerInstall;
}

// ── Versions ──────────────────────────────────────────────────────────────

const SERVER_VERSION_RE = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/** « 1.22.3 » ou « v1.22.3 » → [1, 22, 3] ; `null` pour tout le reste (pré-versions comprises). */
export function parseServerVersion(raw: unknown): [number, number, number] | null {
  if (typeof raw !== "string") return null;
  const match = SERVER_VERSION_RE.exec(raw.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Négatif si `a` est plus ancienne que `b`, positif si plus récente, zéro si
 * égales. Une version illisible se range avant toutes les autres.
 */
export function compareServerVersions(a: string, b: string): number {
  const x = parseServerVersion(a);
  const y = parseServerVersion(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < 3; i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}
