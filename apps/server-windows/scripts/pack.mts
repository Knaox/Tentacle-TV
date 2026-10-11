/**
 * `makeappx pack` d'un dossier assemblé (`assemble.mts`), NON signé : le Store
 * signe lui-même ; un essai en VM signe à part (`msix/vm/`).
 *
 *   pnpm --filter @tentacle-tv/server-windows pack -- --dir <dossier> --msix <fichier.msix>
 *
 * makeappx vient du SDK Windows le plus récent installé ; sans SDK, rien ne se
 * fait (le message dit lequel installer). La validation SÉMANTIQUE du
 * manifeste reste active (pas de `/nv`) : un manifeste refusé l'est ici, pas
 * par le Store.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function makeappx(): string {
  const bin = join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Windows Kits", "10", "bin");
  const versions = existsSync(bin)
    ? readdirSync(bin)
        .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name) && existsSync(join(bin, name, "x64", "makeappx.exe")))
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    : [];
  const latest = versions.at(-1);
  if (latest === undefined) throw new Error("makeappx introuvable : installer le SDK Windows 10.0.26100 ou plus (uap17)");
  return join(bin, latest, "x64", "makeappx.exe");
}

function option(argv: readonly string[], name: string): string {
  const value = argv[argv.indexOf(name) + 1];
  if (!argv.includes(name) || value === undefined || value.startsWith("--")) throw new Error(`${name} manquant`);
  return resolve(value);
}

function main(): void {
  const argv = process.argv.slice(2);
  const dir = option(argv, "--dir");
  const msix = option(argv, "--msix");
  if (!existsSync(join(dir, "AppxManifest.xml"))) throw new Error(`${dir} n'est pas un paquet assemblé`);
  const tool = makeappx();
  console.log(`[pack] ${tool}`);
  execFileSync(tool, ["pack", "/d", dir, "/p", msix, "/o"], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`[pack] ${msix} : ${(statSync(msix).size / 1024 / 1024).toFixed(1)} Mo`);
}

try {
  main();
} catch (error) {
  console.error(`[pack] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
