import { readFileSync } from "fs";
import { isAbsolute, resolve } from "path";

/**
 * La connexion à l'ancienne base MariaDB (ou MySQL) d'une installation qui passe
 * à SQLite.
 *
 * OÙ elle est se décide dans le socle (`services/database/legacySource.ts` →
 * `legacyMariadbUrl()` : `DATABASE_URL`, variables `DB_*` des piles, fichier de
 * l'ancien assistant). Ce module relit l'URL EXACTEMENT comme la 1.24 la donnait
 * à Prisma — mêmes paramètres, même sens — et la traduit pour le pilote :
 *
 * - `sslaccept`, `sslcert`, `sslidentity`, `sslpassword` : la moindre demande de
 *   TLS rend le TLS OBLIGATOIRE (jamais une connexion en clair à sa place) ;
 * - `connect_timeout`, `socket_timeout` (secondes), `socket` (socket Unix) ;
 * - les réglages du pool de Prisma (`connection_limit`, `pool_timeout`…), sans
 *   objet pour une lecture, sont ignorés ;
 * - tout AUTRE paramètre : refus clair, plutôt qu'une connexion au sens douteux.
 *
 * Tout ce dossier (`legacySource/`) ne sert qu'à LIRE une source : il partira
 * avec le support de MariaDB, dans deux ou trois versions.
 */

/** Un paramètre que la copie ne sait pas honorer : la migration s'arrête proprement. */
export class SourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceConfigError";
  }
}

/** Les chemins relatifs de Prisma partaient du dossier du schéma (`apps/backend/prisma`). */
const PRISMA_DIR = resolve(__dirname, "../../../prisma");
const IGNORED = new Set(["connection_limit", "pool_timeout", "max_idle_connection_lifetime", "statement_cache_size"]);
const KNOWN = new Set(["sslaccept", "sslcert", "sslidentity", "sslpassword", "connect_timeout", "socket_timeout", "socket", ...IGNORED]);

export interface SourceConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectTimeout: number;
  socketTimeout: number;
  socketPath?: string;
  ssl?: { rejectUnauthorized: boolean; ca?: Buffer; pfx?: Buffer; passphrase?: string };
  /**
   * MySQL 8 authentifie par défaut en `caching_sha2_password` : sans TLS, l'échange
   * complet chiffre le mot de passe avec la clé publique du serveur, qu'il faut donc
   * lui demander. Prisma (la 1.24) le faisait ; sans cela, toute source MySQL 8 sans
   * TLS échouait en « source injoignable » (mesuré au banc, MySQL 8.4). MariaDB n'a
   * pas ce mode et ignore l'option ; avec TLS, le canal chiffré suffit.
   */
  allowPublicKeyRetrieval: boolean;
}

/** Une URL MariaDB/MySQL — une URL `file:` (SQLite) n'est pas une source. */
export function isMariadbUrl(url: string | undefined | null): url is string {
  return !!url && /^(mysql|mariadb):\/\//i.test(url.trim());
}

function seconds(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new SourceConfigError(`paramètre ${name}=${value} illisible (un nombre de secondes)`);
  return Math.round(n * 1000);
}

/** Paramètres du pilote. Lève `SourceConfigError` sur ce qui ne se comprend pas. */
export function connectionOptions(url: string, readFile: (path: string) => Buffer = (p) => readFileSync(p)): SourceConnectionOptions {
  const u = new URL(url.trim().replace(/^mariadb:/i, "mysql:"));
  const params = u.searchParams;
  for (const name of params.keys()) {
    if (!KNOWN.has(name)) throw new SourceConfigError(`paramètre d'URL inconnu « ${name} » : la migration ne le sait pas honorer`);
  }
  const options: SourceConnectionOptions = {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    connectTimeout: params.has("connect_timeout") ? seconds("connect_timeout", params.get("connect_timeout")!) : 10_000,
    // Une coupure réseau en pleine copie se voit en une minute au plus.
    socketTimeout: params.has("socket_timeout") ? seconds("socket_timeout", params.get("socket_timeout")!) : 60_000,
    allowPublicKeyRetrieval: true,
  };
  if (params.get("socket")) options.socketPath = params.get("socket")!;
  const accept = params.get("sslaccept");
  if (accept !== null && accept !== "strict" && accept !== "accept_invalid_certs") {
    throw new SourceConfigError(`sslaccept=${accept} inconnu (strict ou accept_invalid_certs)`);
  }
  if (accept !== null || params.has("sslcert") || params.has("sslidentity")) {
    const file = (p: string) => readFile(isAbsolute(p) ? p : resolve(PRISMA_DIR, p));
    try {
      options.ssl = {
        rejectUnauthorized: accept !== "accept_invalid_certs",
        ...(params.get("sslcert") ? { ca: file(params.get("sslcert")!) } : {}),
        ...(params.get("sslidentity") ? { pfx: file(params.get("sslidentity")!) } : {}),
        ...(params.get("sslpassword") ? { passphrase: params.get("sslpassword")! } : {}),
      };
    } catch {
      throw new SourceConfigError("un fichier de certificat de la base (sslcert / sslidentity) est illisible");
    }
  }
  return options;
}

/** Les paramètres ignorés (réglages de pool) : dits une fois au journal. */
export function ignoredParams(url: string): string[] {
  const u = new URL(url.trim().replace(/^mariadb:/i, "mysql:"));
  return [...u.searchParams.keys()].filter((name) => IGNORED.has(name));
}

/** L'URL dite au journal : hôte, port, base, TLS — jamais l'utilisateur ni le mot de passe. */
export function describeSource(url: string): string {
  const u = new URL(url.trim().replace(/^mariadb:/i, "mysql:"));
  const tls = [...u.searchParams.keys()].some((k) => k.startsWith("ssl")) ? ", TLS" : "";
  const where = u.searchParams.get("socket") ? `socket ${u.searchParams.get("socket")}` : `${u.hostname}:${u.port || 3306}`;
  return `${where}/${decodeURIComponent(u.pathname.replace(/^\//, ""))}${tls}`;
}

/**
 * L'IDENTITÉ d'une source : où elle est (hôte ou socket, port, nom de base),
 * jamais qui s'y connecte. Gardée dans le rapport de migration : une source
 * configurée qui n'est plus celle-là se signale au démarrage.
 */
export interface SourceIdentity {
  host: string;
  port: number;
  database: string;
}

export function sourceIdentity(url: string): SourceIdentity {
  const u = new URL(url.trim().replace(/^mariadb:/i, "mysql:"));
  const socket = u.searchParams.get("socket");
  return {
    host: socket ? `socket:${socket}` : u.hostname.toLowerCase(),
    port: Number(u.port || 3306),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

export function sameIdentity(a: SourceIdentity | null | undefined, b: SourceIdentity | null | undefined): boolean {
  return !!a && !!b && a.host === b.host && a.port === b.port && a.database === b.database;
}
