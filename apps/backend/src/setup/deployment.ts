import type { ProvisionerKind, SetupDeployment, SetupStack } from "./setupWizardContract";

/**
 * Comment ce serveur a été installé — lu dans l'environnement, jamais deviné
 * en fouillant la machine. L'image pose `TENTACLE_DEPLOYMENT=docker` ; chaque
 * pile compose pose `TENTACLE_STACK` et, pour la pile complète, l'adresse de
 * son Jellyfin voisin.
 *
 * Qui installe, qui configure : la pile (ou la commande officielle de
 * Jellyfin) installe ; l'assistant ne fait que détecter et configurer.
 */
export interface DeploymentEnv {
  TENTACLE_DEPLOYMENT?: string;
  TENTACLE_STACK?: string;
  JELLYFIN_INTERNAL_URL?: string;
  TENTACLE_MEDIA_HOST_PATH?: string;
  /** Les sous-dossiers que crée le service `init` (films, puis séries). */
  TENTACLE_MEDIA_SUBDIRS?: string;
  /** Le port sur lequel la pile complète PUBLIE Jellyfin (`JELLYFIN_PORT`) : celui que les applications joignent. */
  JELLYFIN_HOST_PORT?: string;
}

export interface Deployment {
  deployment: SetupDeployment;
  stack: SetupStack | null;
  provisioner: ProvisionerKind;
  /** Le Jellyfin voisin de la pile complète, joint par le réseau de la pile. */
  siblingUrl: string | null;
  /** Où Jellyfin voit les médias, dans son conteneur (pile complète) : les bibliothèques proposées. */
  mediaFolders: { root: string; movies: string; tvshows: string } | null;
  /** Le dossier des médias sur l'hôte, pour « déposez vos films ici ». */
  mediaHostPath: string | null;
  /** Le port publié de Jellyfin (pile complète) ; `null` s'il n'est pas déclaré — jamais 8096 supposé. */
  jellyfinHostPort: number | null;
}

const STACKS: readonly SetupStack[] = ["full", "db", "only"];

/** L'adresse proposée d'office : là où, d'après l'installation, Jellyfin se trouve. */
const NATIVE_JELLYFIN_URL = "http://127.0.0.1:8096";
const DOCKER_HOST_JELLYFIN_URL = "http://host.docker.internal:8096";

function cleanUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

const MEDIA_ROOT = "/media";

/** Les mêmes noms que le service `init` (`stackInit.ts`), par défaut `films,series`. */
function mediaFolders(subdirs: string | undefined): { root: string; movies: string; tvshows: string } {
  const [movies = "films", tvshows = "series"] = (subdirs ?? "films,series")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => /^[A-Za-z0-9 _.-]+$/.test(name) && name !== "." && name !== "..");
  return { root: MEDIA_ROOT, movies: `${MEDIA_ROOT}/${movies}`, tvshows: `${MEDIA_ROOT}/${tvshows}` };
}

function portOf(value: string | undefined): number | null {
  const port = Number(value?.trim());
  return value?.trim() && Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

export function readDeployment(env: DeploymentEnv = process.env): Deployment {
  const deployment: SetupDeployment = env.TENTACLE_DEPLOYMENT === "docker" ? "docker" : "native";
  const stackValue = env.TENTACLE_STACK?.trim() as SetupStack | undefined;
  const stack = stackValue && STACKS.includes(stackValue) ? stackValue : null;
  const siblingUrl = deployment === "docker" && stack === "full" ? cleanUrl(env.JELLYFIN_INTERNAL_URL) : null;

  // ManagedByTentacle est réservé à la future app d'installation : rien ne
  // l'annonce encore, et aucun environnement ne doit pouvoir le choisir.
  const provisioner: ProvisionerKind = siblingUrl
    ? "docker-sibling"
    : deployment === "native"
      ? "native-host"
      : "existing-instance";

  return {
    deployment,
    stack,
    provisioner,
    siblingUrl,
    mediaFolders: siblingUrl ? mediaFolders(env.TENTACLE_MEDIA_SUBDIRS) : null,
    mediaHostPath: env.TENTACLE_MEDIA_HOST_PATH?.trim() || null,
    jellyfinHostPort: portOf(env.JELLYFIN_HOST_PORT),
  };
}

/** L'adresse de Jellyfin à pré-remplir, selon l'installation. */
export function suggestedJellyfinUrl(d: Deployment): string | null {
  if (d.siblingUrl) return d.siblingUrl;
  if (d.deployment === "native") return NATIVE_JELLYFIN_URL;
  // Piles « base » et « seule » : `host.docker.internal` y est déclaré
  // (`extra_hosts`), c'est le Jellyfin installé sur la même machine.
  return d.stack ? DOCKER_HOST_JELLYFIN_URL : null;
}
