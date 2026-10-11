/**
 * Signe un MSIX pour un ESSAI EN VM, jamais pour le Store (qui signe lui-même).
 *
 *   pnpm --filter @tentacle-tv/server-windows sign:dev -- --msix <fichier.msix> --out <dossier>
 *
 * Le certificat est autosigné, au sujet EXACT de `Identity/@Publisher` de
 * l'identité de développement (`CN=Tentacle Server Dev`), fabriqué par
 * openssl dans `--out` : RIEN n'entre dans un magasin de certificats de ce PC.
 * La VM, elle, l'importe dans « Personnes autorisées » (`msix/vm/`).
 *
 * Sortie : `<nom>-vm.msix` signé et `tentacle-server-dev.cer`. La clé privée
 * et le PFX restent dans `--out` (dossier jetable, hors dépôt).
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { DEV_IDENTITY } from "./assemble/manifest.mts";

function option(argv: readonly string[], name: string): string {
  const value = argv[argv.indexOf(name) + 1];
  if (!argv.includes(name) || value === undefined || value.startsWith("--")) throw new Error(`${name} manquant`);
  return resolve(value);
}

function signtool(): string {
  const bin = join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Windows Kits", "10", "bin");
  const latest = readdirSync(bin)
    .filter((name) => existsSync(join(bin, name, "x64", "signtool.exe")))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .at(-1);
  if (latest === undefined) throw new Error("signtool introuvable : installer le SDK Windows");
  return join(bin, latest, "x64", "signtool.exe");
}

/** openssl : celui du PATH, sinon celui de Git pour Windows. */
function openssl(): string {
  const git = join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "mingw64", "bin", "openssl.exe");
  return existsSync(git) ? git : "openssl";
}

function main(): void {
  const argv = process.argv.slice(2);
  const msix = option(argv, "--msix");
  const out = option(argv, "--out");
  mkdirSync(out, { recursive: true });
  // Le sujet du certificat DOIT être `Identity/@Publisher`, sans quoi la VM refuse le paquet.
  const subject = `/${DEV_IDENTITY.publisher}`;
  const key = join(out, "tentacle-server-dev.key");
  const pem = join(out, "tentacle-server-dev.pem");
  const cer = join(out, "tentacle-server-dev.cer");
  const pfx = join(out, "tentacle-server-dev.pfx");
  const password = randomBytes(18).toString("base64url");
  const ssl = openssl();
  execFileSync(ssl, [
    "req", "-x509", "-newkey", "rsa:3072", "-sha256", "-days", "90", "-nodes",
    "-keyout", key, "-out", pem, "-subj", subject,
    "-addext", "basicConstraints=critical,CA:FALSE",
    "-addext", "keyUsage=critical,digitalSignature",
    "-addext", "extendedKeyUsage=codeSigning",
  ], { stdio: "inherit" });
  execFileSync(ssl, ["x509", "-in", pem, "-outform", "DER", "-out", cer], { stdio: "inherit" });
  execFileSync(ssl, ["pkcs12", "-export", "-inkey", key, "-in", pem, "-out", pfx, "-passout", `pass:${password}`], {
    stdio: "inherit",
  });
  const signed = join(out, basename(msix).replace(/\.msix$/i, "-vm.msix"));
  copyFileSync(msix, signed);
  execFileSync(signtool(), ["sign", "/fd", "SHA256", "/f", pfx, "/p", password, signed], { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`[sign:dev] ${signed}`);
  console.log(`[sign:dev] ${cer} (à importer DANS LA VM, « Personnes autorisées »)`);
}

try {
  main();
} catch (error) {
  console.error(`[sign:dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
