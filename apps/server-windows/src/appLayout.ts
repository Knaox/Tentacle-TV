/**
 * Où vit ce que l'hôte lance : la RACINE de l'application, qui reproduit
 * `/app` de l'image Docker à l'identique (`apps/backend/dist`, `apps/web/dist`,
 * `versions.json`, `compat/`, `node_modules`…). Le serveur trouve tout par
 * `__dirname` ; rien ne se recopie ailleurs.
 *
 * L'hôte lui-même est `apps/server-windows/dist/main.js` sous cette racine :
 * dans le paquet comme dans le dépôt. D'où le défaut (trois crans au-dessus),
 * que `--app-root <dossier>` ou `TENTACLE_APP_ROOT` remplacent pour essayer
 * l'hôte contre un autre arbre.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface AppLayout {
  root: string;
  /** `apps/backend` : le `WORKDIR` de l'image, `cwd` du serveur. */
  backendDir: string;
  serverEntry: string;
  /** La commande `tentacle` du serveur (`cli/tentacle.js`), lancée par l'alias. */
  cliEntry: string;
  /** La version du paquet MSIX (`AppxManifest.xml`), `null` hors paquet. */
  packageVersion: string | null;
  /** Les dépendances partagées des extensions, recopiées à chaque démarrage. */
  sharedDepsSeed: string | null;
  /** L'icône de la zone de notification ; `null` → icône générique de Windows. */
  trayIcon: string | null;
  /** Python embarquable et zipapp yt-dlp du paquet (absents hors paquet). */
  python: string | null;
  ytDlp: string | null;
  /** Le manifeste de compatibilité Jellyfin (`compat/jellyfin.json`), comme dans l'image. */
  jellyfinCompat: string;
  /** Les réglages de l'app posés par le paquet (`host-options.json`, facultatif). */
  hostOptions: string;
}

function firstExisting(paths: readonly string[]): string | null {
  return paths.find((p) => existsSync(p)) ?? null;
}

export function argValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value !== undefined && !value.startsWith("--") ? value : null;
}

export function resolveAppRoot(argv: readonly string[], env: NodeJS.ProcessEnv, hostDir: string): string {
  return resolve(argValue(argv, "--app-root") ?? env.TENTACLE_APP_ROOT ?? join(hostDir, "..", "..", ".."));
}

/** `Identity/@Version` du manifeste, sans le 4e champ (toujours 0 pour le Store). */
export function manifestVersion(manifest: string): string | null {
  const identity = /<Identity\b[^>]*>/.exec(manifest)?.[0] ?? "";
  const version = /\bVersion="(\d+\.\d+\.\d+)\.\d+"/.exec(identity)?.[1];
  return version ?? null;
}

function packageVersion(root: string): string | null {
  try {
    return manifestVersion(readFileSync(join(root, "AppxManifest.xml"), "utf8"));
  } catch {
    return null;
  }
}

export function appLayout(root: string): AppLayout {
  const backendDir = join(root, "apps", "backend");
  return {
    root,
    backendDir,
    serverEntry: join(backendDir, "dist", "index.js"),
    cliEntry: join(backendDir, "dist", "cli", "tentacle.js"),
    packageVersion: packageVersion(root),
    // Le paquet suit l'image (`/app/shared-deps-seed`) ; le dépôt, `pnpm build:shared-deps`.
    sharedDepsSeed: firstExisting([join(root, "shared-deps-seed"), join(backendDir, "data", "shared-deps")]),
    // Le paquet porte la sienne (fil D, tirée de `brand/`) ; le dépôt prend celle du bureau.
    trayIcon: firstExisting([
      join(root, "apps", "server-windows", "assets", "tray.ico"),
      join(root, "apps", "desktop-electron", "icons", "icon.ico"),
    ]),
    python: firstExisting([join(root, "python", "python.exe")]),
    ytDlp: firstExisting([join(root, "tools", "yt-dlp")]),
    jellyfinCompat: join(root, "compat", "jellyfin.json"),
    hostOptions: join(root, "apps", "server-windows", "host-options.json"),
  };
}
