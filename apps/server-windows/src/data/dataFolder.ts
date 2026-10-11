/**
 * Préparer le dossier de données avant le premier lancement du serveur, et le
 * supprimer quand l'utilisateur le demande.
 *
 * Trois cas au démarrage :
 * - il n'existe pas : on le crée, puis on pose les droits (`folderAcl.ts`) ;
 * - il existe et on y écrit : rien à faire ;
 * - il existe et on n'y écrit pas : un AUTRE compte Windows l'a créé (ses
 *   droits nous excluent). On le dit, sans rien toucher.
 */
import { accessSync, constants, mkdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataLayout } from "./dataLayout";
import { restrictToOwner } from "./folderAcl";

export type PrepareResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: "other_account" }
  | { ok: false; reason: "failed"; detail: string };

function isAccessDenied(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "EPERM" || code === "EACCES";
}

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch (error) {
    // Un dossier qu'on ne peut même pas lire existe bel et bien.
    return isAccessDenied(error);
  }
}

/** Écrire pour de vrai : `accessSync` seul se trompe sur les ACL de Windows. */
function probeWrite(dir: string): void {
  accessSync(dir, constants.R_OK | constants.W_OK);
  const probe = join(dir, `.host-probe-${process.pid}`);
  writeFileSync(probe, "");
  unlinkSync(probe);
}

export async function prepareDataFolder(layout: DataLayout, systemRoot: string): Promise<PrepareResult> {
  const created = !exists(layout.root);
  try {
    if (created) {
      mkdirSync(layout.root, { recursive: true });
      await restrictToOwner(layout.root, systemRoot);
    }
    probeWrite(layout.root);
    mkdirSync(layout.logs, { recursive: true });
    mkdirSync(layout.cache, { recursive: true });
    return { ok: true, created };
  } catch (error) {
    if (!created && isAccessDenied(error)) return { ok: false, reason: "other_account" };
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Supprime TOUT le dossier de données. Appelée seulement après la
 * confirmation explicite de l'utilisateur, serveur arrêté. Rend `false` si
 * quelque chose est resté (un fichier tenu par un autre programme).
 */
export function deleteDataFolder(layout: DataLayout): boolean {
  try {
    rmSync(layout.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return !exists(layout.root);
  } catch {
    return false;
  }
}
