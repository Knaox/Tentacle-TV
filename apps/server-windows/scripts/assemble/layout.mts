/**
 * La racine du paquet reproduit `/app` de l'image Docker À L'IDENTIQUE : le
 * serveur trouve ses fichiers par `__dirname` (client web, client LG,
 * migrations, `versions.json`, `compat/`). Le plan suit l'étape « server » du
 * `Dockerfile` ; `layout.test.ts` relit le Dockerfile et refuse un écart.
 *
 * S'y ajoutent ce qui est propre à Windows : l'hôte (`apps/server-windows`),
 * l'exe, Python et yt-dlp (posés par `assemble.mts`).
 */
import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export interface CopyStep {
  /** Relatif au dépôt. */
  from: string;
  /** Relatif à la racine du paquet. */
  to: string;
}

/** Les `COPY --from=base /app/…` de l'étape « server », dans l'ordre du Dockerfile. */
export const SERVER_COPIES: readonly CopyStep[] = [
  { from: "apps/backend/package.json", to: "apps/backend/package.json" },
  { from: "apps/backend/dist", to: "apps/backend/dist" },
  { from: "apps/backend/prisma/migrations-sqlite", to: "apps/backend/prisma/migrations-sqlite" },
  { from: "apps/backend/prisma/core-init.sql", to: "apps/backend/prisma/core-init.sql" },
  { from: "apps/backend/data/shared-deps", to: "shared-deps-seed" },
  { from: "apps/web/dist", to: "apps/web/dist" },
  { from: "versions.json", to: "versions.json" },
  { from: "compat/jellyfin.json", to: "compat/jellyfin.json" },
  { from: "LICENSE", to: "LICENSE" },
  { from: "LICENSE-EXCEPTIONS", to: "LICENSE-EXCEPTIONS" },
  { from: "apps/backend/THIRD-PARTY-LICENSES.md", to: "THIRD-PARTY-LICENSES.md" },
];

/** L'hôte : son bundle et l'icône de la zone de notification (`appLayout.ts`). */
export const HOST_COPIES: readonly CopyStep[] = [
  { from: "apps/server-windows/dist/main.js", to: "apps/server-windows/dist/main.js" },
  { from: "apps/server-windows/assets/tray.ico", to: "apps/server-windows/assets/tray.ico" },
];

/** Où `staticClients.ts` cherche le client LG, depuis `apps/backend/dist/static`. */
export const TV_CLIENT_TARGET = "apps/tv-webos/client/dist";

/**
 * Les sources `/app/…` des `COPY --from=base` de l'étape « server » du
 * Dockerfile — de quoi vérifier que le plan n'a rien oublié.
 */
export function dockerServerSources(dockerfile: string): string[] {
  const stage = /^FROM \S+ AS server\s*$([\s\S]*?)^FROM /m.exec(dockerfile)?.[1];
  if (stage === undefined) throw new Error("étape « server » introuvable dans le Dockerfile");
  const sources: string[] = [];
  for (const line of stage.split(/\r?\n/)) {
    if (!line.startsWith("COPY --from=base ")) continue;
    const paths = line.slice("COPY --from=base ".length).trim().split(/\s+/);
    for (const path of paths.slice(0, -1)) sources.push(path.replace(/^\/app\//, ""));
  }
  return sources;
}

/** Une copie : les cartes de sources ne partent pas (comme `find dist -name '*.map' -delete`). */
export function copyStep(repo: string, root: string, step: CopyStep): void {
  const source = join(repo, step.from);
  if (!existsSync(source)) throw new Error(`absent : ${step.from} (construire d'abord, ou --skip-build à retirer)`);
  const target = join(root, step.to);
  mkdirSync(dirname(target), { recursive: true });
  if (statSync(source).isDirectory()) {
    cpSync(source, target, { recursive: true, dereference: true, filter: (path) => !path.endsWith(".map") });
  } else {
    cpSync(source, target, { dereference: true });
  }
}

export function copyTvClient(clientDist: string, root: string): void {
  if (!existsSync(join(clientDist, "index.html"))) {
    // Sans index.html, /tv servirait l'index du client WEB : un téléviseur chargerait
    // l'application de bureau (même garde que la dernière étape du Dockerfile).
    throw new Error(`client LG sans index.html : ${clientDist}`);
  }
  const target = join(root, TV_CLIENT_TARGET);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(clientDist, target, { recursive: true, dereference: true });
}
