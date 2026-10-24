/**
 * Ce que le paquet embarque sans le construire : Node, Python, yt-dlp. Chaque
 * fichier est ÉPINGLÉ (version + SHA-256) ; une empreinte qui ne correspond
 * pas arrête l'assemblage, jamais un « ça ira ».
 *
 * - Node : l'archive officielle de nodejs.org, recoupée en plus avec son
 *   `SHASUMS256.txt` (deux sources d'accord, ou rien).
 * - Python : l'archive « embeddable » de python.org, signée par la PSF —
 *   Smart App Control la laisse tourner, là où un exe neuf non signé est
 *   bloqué. Empreinte publiée par python.org (`sha256_sum` de son API).
 * - yt-dlp : le zipapp officiel, aux MÊMES version et empreinte que l'image
 *   Docker. Lues dans le `Dockerfile` (ARG `YTDLP_VERSION`, `YTDLP_SHA256`) :
 *   on monte de version à un seul endroit (docs/RELEASE.md).
 *
 * Monter Node ou Python : changer version ET empreinte ici, relevées sur la
 * source officielle, jamais recopiées d'ailleurs.
 */

export interface PinnedFile {
  name: string;
  version: string;
  url: string;
  /** SHA-256 en hexadécimal minuscule. */
  sha256: string;
  /** Nom du fichier dans le cache des téléchargements. */
  fileName: string;
}

const NODE_VERSION = "24.22.1";
const NODE_ARCHIVE = `node-v${NODE_VERSION}-win-x64.zip`;

export const NODE: PinnedFile & { shasumsUrl: string; folder: string } = {
  name: "node",
  version: NODE_VERSION,
  url: `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}`,
  shasumsUrl: `https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`,
  sha256: "d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5",
  fileName: NODE_ARCHIVE,
  /** Le dossier racine de l'archive. */
  folder: `node-v${NODE_VERSION}-win-x64`,
};

const PYTHON_VERSION = "3.13.16";

export const PYTHON: PinnedFile = {
  name: "python",
  version: PYTHON_VERSION,
  url: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
  sha256: "97dae5274cc54867065e8d5a3226e48c35017ed332a0fdb0e27d5b5821961297",
  fileName: `python-${PYTHON_VERSION}-embed-amd64.zip`,
};

/** Une ligne `ARG NOM=valeur` du Dockerfile. */
export function dockerArg(dockerfile: string, name: string): string {
  const match = new RegExp(`^ARG ${name}=(\\S+)\\s*$`, "m").exec(dockerfile);
  if (match?.[1] === undefined) throw new Error(`ARG ${name} introuvable dans le Dockerfile`);
  return match[1];
}

export function ytDlpPin(dockerfile: string): PinnedFile {
  const version = dockerArg(dockerfile, "YTDLP_VERSION");
  const sha256 = dockerArg(dockerfile, "YTDLP_SHA256").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`YTDLP_SHA256 invalide : ${sha256}`);
  return {
    name: "yt-dlp",
    version,
    url: `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/yt-dlp`,
    sha256,
    fileName: `yt-dlp-${version}`,
  };
}

/** L'empreinte d'un fichier dans un `SHASUMS256.txt` (« empreinte  nom »). */
export function shasumOf(shasums: string, fileName: string): string | null {
  for (const line of shasums.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (match?.[2] === fileName && match[1] !== undefined) return match[1].toLowerCase();
  }
  return null;
}
