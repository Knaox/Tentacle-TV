import { readFileSync } from "fs";
import { join } from "path";

/**
 * `versions.json` à la racine du repo — la source unique des versions. Même
 * profondeur en dev (src/services) et en prod Docker (dist/services, le fichier
 * étant copié dans /app).
 */
const versions: Record<string, unknown> = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../../../versions.json"), "utf-8"));
  } catch {
    return {}; /* versions.json absent (ancienne image) → replis ci-dessous */
  }
})();

/**
 * La version FIXÉE AU BUILD (`TENTACLE_SERVER_VERSION` : argument de build de
 * l'image Docker, ou variable d'environnement en dev) : `X.Y.Z`, ou
 * `X.Y.Z+<build>` — la métadonnée de build ne compte pas, `1.40.0+preview.abc`
 * vaut 1.40.0 (jamais `-preview`, qui vaudrait moins). Elle l'emporte sur
 * `versions.json` partout où le serveur dit sa version : `/api/config`,
 * `/api/health`, capacités déclarées, compatibilité des extensions, carte
 * « Serveur Tentacle ». `versions.json` n'est jamais réécrit pour autant.
 */
export const SERVER_VERSION_OVERRIDE_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}(\+[0-9A-Za-z][0-9A-Za-z.-]{0,63})?$/;

export interface ServerVersionInput {
  /** `TENTACLE_SERVER_VERSION`, telle que lue (vide ou absente : rien). */
  override?: string | undefined;
  /** `versions.json` → `server`. */
  versionsServer?: unknown;
  /** Le repli : la version du package.json du backend. */
  packageVersion?: () => string;
}

/** Règle pure : la version que le serveur dit, et une valeur forcée refusée (forme illisible). */
export function resolveServerVersion(input: ServerVersionInput): { version: string; rejected: string | null } {
  const forced = input.override?.trim() ?? "";
  if (forced && SERVER_VERSION_OVERRIDE_RE.test(forced)) return { version: forced, rejected: null };
  const rejected = forced || null;
  if (typeof input.versionsServer === "string" && input.versionsServer) return { version: input.versionsServer, rejected };
  return { version: input.packageVersion?.() || "0.0.0", rejected };
}

function packageVersion(): string {
  try {
    return JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Version du serveur : `TENTACLE_SERVER_VERSION`, sinon `versions.json` (champ `server`), sinon package.json. */
export const BACKEND_VERSION: string = (() => {
  const { version, rejected } = resolveServerVersion({
    override: process.env.TENTACLE_SERVER_VERSION,
    versionsServer: versions.server,
    packageVersion,
  });
  if (rejected) console.warn(`[version] TENTACLE_SERVER_VERSION ignorée (attendu X.Y.Z ou X.Y.Z+build) : version ${version}`);
  else if (process.env.TENTACLE_SERVER_VERSION?.trim()) console.log(`[version] version fixée au build : ${version}`);
  return version;
})();

/**
 * Époque de jumelage des téléviseurs (champ `tvPairingEpoch`).
 *
 * Un entier qui ne fait que monter. Chaque incrément vaut ordre de rejumelage
 * général : au démarrage, le serveur compare cette valeur à celle qu'il a déjà
 * appliquée et, si elle a monté, révoque TOUS les appareils jumelés. C'est le
 * seul levier qui couvre un parc — révoquer depuis l'interface est un geste
 * manuel, appareil par appareil.
 *
 * Se bump à la main dans `versions.json` : `.github/scripts/bump-version.mjs`
 * ne connaît que les champs en X.Y.Z et n'a rien à faire ici.
 *
 * Repli à 0 : une image sans le champ ne déjumelle personne. La chaîne est
 * acceptée autant que le nombre — un `"2"` recopié à la main ne doit pas se
 * traduire par une révocation silencieusement escamotée.
 */
export const TV_PAIRING_EPOCH: number = (() => {
  const v = versions.tvPairingEpoch;
  const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
  if (typeof n === "number" && Number.isFinite(n)) return Math.trunc(n);
  return 0;
})();
