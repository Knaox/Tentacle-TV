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
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface AppLayout {
  root: string;
  /** `apps/backend` : le `WORKDIR` de l'image, `cwd` du serveur. */
  backendDir: string;
  serverEntry: string;
  /** Les dépendances partagées des extensions, recopiées à chaque démarrage. */
  sharedDepsSeed: string | null;
  /** L'icône de la zone de notification ; `null` → icône générique de Windows. */
  trayIcon: string | null;
  /** Python embarquable et zipapp yt-dlp du paquet (absents hors paquet). */
  python: string | null;
  ytDlp: string | null;
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

export function appLayout(root: string): AppLayout {
  const backendDir = join(root, "apps", "backend");
  return {
    root,
    backendDir,
    serverEntry: join(backendDir, "dist", "index.js"),
    // Le paquet suit l'image (`/app/shared-deps-seed`) ; le dépôt, `pnpm build:shared-deps`.
    sharedDepsSeed: firstExisting([join(root, "shared-deps-seed"), join(backendDir, "data", "shared-deps")]),
    // Le paquet porte la sienne (fil D, tirée de `brand/`) ; le dépôt prend celle du bureau.
    trayIcon: firstExisting([
      join(root, "apps", "server-windows", "assets", "tray.ico"),
      join(root, "apps", "desktop-electron", "icons", "icon.ico"),
    ]),
    python: firstExisting([join(root, "python", "python.exe")]),
    ytDlp: firstExisting([join(root, "tools", "yt-dlp")]),
  };
}
