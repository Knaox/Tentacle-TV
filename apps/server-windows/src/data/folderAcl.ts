/**
 * Les droits du dossier de données.
 *
 * Sous `ProgramData`, le groupe Utilisateurs lit tout par défaut, et les
 * `chmod 0o600` du serveur ne valent rien sous Windows : un autre compte du PC
 * lirait la base (secret JWT, clés). À la création, l'hôte coupe l'héritage et
 * ne laisse que SYSTEM, les Administrateurs et le compte qui installe.
 *
 * `icacls` plutôt qu'un appel FFI à `SetNamedSecurityInfoW` : un exécutable
 * signé de Windows, lancé par son chemin absolu (jamais par le `PATH`).
 */
import { execFile } from "node:child_process";
import { join } from "node:path";

/** SYSTEM et Administrateurs, par SID : leurs noms changent avec la langue. */
const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";

export function isUserSid(value: string): boolean {
  return /^S-1-5-21(-\d+){4}$/.test(value);
}

/** Héritage coupé, contrôle total aux trois seuls ayants droit, transmis aux enfants. */
export function aclArgs(dir: string, userSid: string): string[] {
  const full = (sid: string): string => `*${sid}:(OI)(CI)F`;
  return [dir, "/inheritance:r", "/grant:r", full(SYSTEM_SID), full(ADMINISTRATORS_SID), full(userSid)];
}

/** `whoami /user /fo csv /nh` → `"pc\nom","S-1-5-21-…"`. */
export function parseWhoamiSid(output: string): string | null {
  const match = /"(S-1-5-21(?:-\d+){4})"/.exec(output);
  return match?.[1] ?? null;
}

function run(file: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${file} : ${stderr.trim() || error.message}`));
      else resolve(stdout);
    });
  });
}

function system32(systemRoot: string, exe: string): string {
  return join(systemRoot, "System32", exe);
}

export async function currentUserSid(systemRoot: string): Promise<string> {
  const sid = parseWhoamiSid(await run(system32(systemRoot, "whoami.exe"), ["/user", "/fo", "csv", "/nh"]));
  if (sid === null) throw new Error("SID du compte introuvable");
  return sid;
}

export async function restrictToOwner(dir: string, systemRoot: string): Promise<void> {
  const sid = await currentUserSid(systemRoot);
  await run(system32(systemRoot, "icacls.exe"), aclArgs(dir, sid));
}
