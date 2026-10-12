/**
 * L'assemblage du paquet MSIX de Tentacle Server : un dossier prêt pour
 * `makeappx pack` (`pack.mts`). Options : `assemble/args.mts`.
 *
 * Sous Windows seulement : `prisma generate` doit y poser le moteur Windows,
 * et l'exe, Python et koffi sont ceux de Windows x64.
 *
 * Ordre : construire → dépendances de production (verrou, moteur Windows,
 * élagage) → `/app` à l'identique de l'image → l'hôte et koffi → l'exe, Python,
 * yt-dlp → manifeste, tuiles et leur index (`resources.pri`) → poids.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAssembleArgs } from "./assemble/args.mts";
import { buildSources, deployProdDeps } from "./assemble/build.mts";
import { copyKoffi } from "./assemble/koffi.mts";
import { HOST_COPIES, SERVER_COPIES, copyStep, copyTvClient } from "./assemble/layout.mts";
import { renderManifest } from "./assemble/manifest.mts";
import { measure, megabytes } from "./assemble/measure.mts";
import { checkYtDlp, installNode, installPython, installYtDlp } from "./assemble/runtimes.mts";

const log = (line: string): void => console.log(`[assemble] ${line}`);
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(appDir, "..", "..");

/** Le dossier de sortie est vidé — seulement s'il est vide ou déjà un paquet assemblé. */
function prepareOut(out: string): void {
  if (existsSync(out) && readdirSync(out).length > 0) {
    if (!existsSync(join(out, "AppxManifest.xml"))) {
      throw new Error(`${out} n'est ni vide ni un paquet assemblé : rien n'est effacé`);
    }
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
}

async function main(): Promise<void> {
  if (process.platform !== "win32") throw new Error("l'assemblage du paquet Windows se fait sous Windows");
  const options = parseAssembleArgs(process.argv.slice(2), repo);
  const root = options.out;
  const work = join(options.cacheDir, "work");
  log(`paquet ${options.version} → ${root}`);

  if (!options.skipBuild) buildSources(repo, options.tvClient === null, log);
  const nodeModules = deployProdDeps(repo, work, log);

  prepareOut(root);
  cpSync(nodeModules, join(root, "node_modules"), { recursive: true, dereference: true });
  for (const step of [...SERVER_COPIES, ...HOST_COPIES]) copyStep(repo, root, step);
  copyTvClient(options.tvClient ?? join(repo, "apps", "tv-webos", "client", "dist"), root);
  copyKoffi(join(repo, "node_modules"), join(root, "apps", "server-windows", "node_modules"));
  // Absent, l'installation guidée de Jellyfin est permise (`src/hostOptions.ts`).
  if (!options.jellyfinInstaller) {
    writeFileSync(join(root, "apps", "server-windows", "host-options.json"), `${JSON.stringify({ jellyfinInstaller: false })}\n`);
    log("installation guidée de Jellyfin coupée (host-options.json)");
  }

  const dockerfile = readFileSync(join(repo, "Dockerfile"), "utf8");
  await installNode(root, options.cacheDir, log);
  await installPython(root, options.cacheDir, log);
  const ytDlpVersion = await installYtDlp(root, dockerfile, options.cacheDir, log);
  checkYtDlp(root, ytDlpVersion);

  const template = readFileSync(join(appDir, "msix", "Package.appxmanifest"), "utf8");
  writeFileSync(join(root, "AppxManifest.xml"), renderManifest(template, options.identity, options.version));
  mkdirSync(join(root, "Assets"), { recursive: true });
  for (const name of readdirSync(join(appDir, "msix", "Assets"))) {
    copyFileSync(join(appDir, "msix", "Assets", name), join(root, "Assets", name));
  }
  // Les visuels sont qualifiés (`.scale-200`, `.targetsize-24_altform-unplated`) :
  // sans leur index, Windows ne les voit pas et pose l'icône sur une plaque.
  execFileSync(process.execPath, [join(repo, ".github", "scripts", "msix-resources.mjs"), "--stage", root], {
    stdio: "inherit",
  });

  const size = measure(root);
  log(`poids installé : ${megabytes(size.total)} en ${size.files} fichiers`);
  for (const part of size.parts.slice(0, 12)) log(`  ${megabytes(part.bytes).padStart(10)}  ${part.part} (${part.files})`);
  writeFileSync(`${root}.size.json`, `${JSON.stringify({ version: options.version, ...size }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(`[assemble] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
