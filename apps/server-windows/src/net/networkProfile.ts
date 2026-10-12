/**
 * Le réseau de ce PC est-il en profil « Public » ? Windows 11 y met souvent
 * un réseau nouveau, et le pare-feu y ferme l'entrée : téléphones et TV ne
 * joignent plus le serveur (la règle du manifeste ne vaut que pour
 * `domainAndPrivate`). L'hôte le dit une fois, et renvoie aux Paramètres.
 *
 * `Get-NetConnectionProfile` par PowerShell, une fois au démarrage, en fond.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";

export interface ConnectionProfile {
  alias: string;
  category: string;
}

/** `ConvertTo-Json` rend un objet seul OU un tableau ; `NetworkCategory` en texte ou en nombre. */
export function parseProfiles(json: string): ConnectionProfile[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [raw];
  const names: Record<number, string> = { 0: "Public", 1: "Private", 2: "DomainAuthenticated" };
  return list.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const category = typeof record.NetworkCategory === "number" ? names[record.NetworkCategory] : record.NetworkCategory;
    return typeof record.InterfaceAlias === "string" && typeof category === "string"
      ? [{ alias: record.InterfaceAlias, category }]
      : [];
  });
}

/** Le profil de la carte qui porte notre adresse locale est-il « Public » ? */
export function isPublic(profiles: readonly ConnectionProfile[], alias: string | null): boolean {
  const match = profiles.find((p) => p.alias === alias) ?? (profiles.length === 1 ? profiles[0] : undefined);
  return match?.category === "Public";
}

export function readProfiles(systemRoot: string): Promise<ConnectionProfile[]> {
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const script = "Get-NetConnectionProfile | Select-Object InterfaceAlias,NetworkCategory | ConvertTo-Json -Compress";
  return new Promise((resolve) => {
    execFile(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, timeout: 15_000 }, (error, stdout) => {
      resolve(error ? [] : parseProfiles(String(stdout)));
    });
  });
}
