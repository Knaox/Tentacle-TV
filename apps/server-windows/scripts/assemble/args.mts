/**
 * Les options de l'assemblage — contrat partagé avec le workflow (fil E) :
 *
 *   pnpm --filter @tentacle-tv/server-windows assemble -- \
 *     --out <dossier> --version X.Y.Z.0 [--tv-client <dossier>]
 *     [--identity-name <nom> --publisher "CN=…" --publisher-display-name <nom>]
 *     [--cache <dossier>] [--skip-build] [--no-jellyfin-installer]
 *
 * Sans `--tv-client`, le client LG se construit depuis les sources (essai
 * local) ; la CI passe celui de l'image en service, comme `server.yml`.
 * `--skip-build` reprend ce qui est déjà construit dans le dépôt.
 * `--no-jellyfin-installer` pose `host-options.json` qui coupe l'installation
 * guidée de Jellyfin (si le Store la refuse, règle 10.1.5) : le paquet est en
 * lecture seule, c'est donc à l'assemblage que ce choix se fait.
 */
import { resolve } from "node:path";
import { DEV_IDENTITY, checkIdentity, checkPackageVersion, type PackageIdentity } from "./manifest.mts";

export interface AssembleOptions {
  out: string;
  version: string;
  tvClient: string | null;
  cacheDir: string;
  skipBuild: boolean;
  jellyfinInstaller: boolean;
  identity: PackageIdentity;
}

const VALUED = new Set(["--out", "--version", "--tv-client", "--cache", "--identity-name", "--publisher", "--publisher-display-name"]);
const FLAGS = new Set(["--skip-build", "--no-jellyfin-installer"]);

export function parseAssembleArgs(argv: readonly string[], repo: string): AssembleOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  // pnpm transmet parfois le `--` qui sépare ses options de celles du script.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (FLAGS.has(arg)) {
      flags.add(arg);
      continue;
    }
    if (!VALUED.has(arg)) throw new Error(`option inconnue : ${arg}`);
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${arg} attend une valeur`);
    values.set(arg, value);
    i++;
  }
  const out = values.get("--out");
  const version = values.get("--version");
  if (out === undefined) throw new Error("--out <dossier> manquant");
  if (version === undefined) throw new Error("--version X.Y.Z.0 manquant");
  const tvClient = values.get("--tv-client");
  return {
    out: resolve(out),
    version: checkPackageVersion(version),
    tvClient: tvClient === undefined ? null : resolve(tvClient),
    cacheDir: resolve(values.get("--cache") ?? resolve(repo, "apps", "server-windows", "scratch", "cache")),
    skipBuild: flags.has("--skip-build"),
    jellyfinInstaller: !flags.has("--no-jellyfin-installer"),
    identity: checkIdentity({
      name: values.get("--identity-name") ?? DEV_IDENTITY.name,
      publisher: values.get("--publisher") ?? DEV_IDENTITY.publisher,
      publisherDisplayName: values.get("--publisher-display-name") ?? DEV_IDENTITY.publisherDisplayName,
    }),
  };
}
