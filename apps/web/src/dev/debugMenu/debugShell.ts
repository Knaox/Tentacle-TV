import { desktopPlatform, isDesktopApp, type DesktopPlatform } from "../../desktop/detect";
import { getMpvApi } from "../../hooks/mpvRuntime";

/**
 * Quelle coquille répond, pour le menu de débogage : Electron (la référence), CEF, ou un
 * navigateur. Les deux coquilles posent le même pont (`window.tentacle`) — la page ne les
 * distingue nulle part ailleurs, et c'est voulu. Ici il le faut : elles n'acceptent pas les
 * mêmes réglages (`apps/desktop-cef/src/bridge/mpv_policy.cpp`), et leur pop-up de mise à jour
 * n'est pas la même. CEF se reconnaît à `window.__shell`, le canal de sa coquille.
 */
export type DebugShellKind = "cef" | "electron" | "web";

export interface DebugShell {
  kind: DebugShellKind;
  platform: DesktopPlatform;
  /** « CEF · macOS », « Electron · Windows », « Navigateur ». */
  label: string;
}

const PLATFORM_LABEL: Record<DesktopPlatform, string> = { windows: "Windows", macos: "macOS", linux: "Linux", web: "Web" };

export function debugShell(): DebugShell {
  if (!isDesktopApp()) return { kind: "web", platform: "web", label: "Navigateur" };
  const kind: DebugShellKind = typeof window !== "undefined" && "__shell" in window ? "cef" : "electron";
  const platform = desktopPlatform();
  return { kind, platform, label: `${kind === "cef" ? "CEF" : "Electron"} · ${PLATFORM_LABEL[platform]}` };
}

/** La coquille annonce-t-elle cette commande ? (`window.tentacle.capabilities`) */
export function shellHasCommand(command: string): boolean {
  return typeof window !== "undefined" && (window.tentacle?.capabilities.includes(command) ?? false);
}

// ── Les propriétés de mpv, en direct ─────────────────────────────────────────

export async function readMpvProp(name: string): Promise<string | null> {
  const api = getMpvApi();
  if (!api) return null;
  try {
    const v = await api.getProperty(name, "string");
    return v === null || v === undefined ? null : String(v);
  } catch {
    return null;
  }
}

/** Écrit une propriété ; rend FAUX si mpv n'est pas là ou si la coquille la refuse. */
export async function writeMpvProp(name: string, value: string): Promise<boolean> {
  const api = getMpvApi();
  if (!api) return false;
  try {
    await api.setProperty(name, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pourquoi un réglage de mpv EN DIRECT ne peut pas agir ici, ou `undefined` s'il le peut.
 * La coquille CEF tient elle-même la chaîne couleur (HDR) : elle refuse ces écritures à la page.
 */
export function liveMpvUnavailable(shell: DebugShell): string | undefined {
  if (shell.kind === "web") return "pas de lecteur mpv dans un navigateur";
  if (shell.kind === "cef") return "tenu par la coquille CEF (chaîne couleur native)";
  if (!getMpvApi()) return "aucune lecture en cours";
  return undefined;
}

/** Une bascule de propriété mpv entre deux valeurs — honnête : dit si l'écriture est passée. */
export async function toggleMpvProp(name: string, a: string, b: string): Promise<string> {
  const current = await readMpvProp(name);
  const next = current === a ? b : a;
  return (await writeMpvProp(name, next)) ? `${name} = ${next}` : `${name} : écriture refusée (reste ${current ?? "?"})`;
}
