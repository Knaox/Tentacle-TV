import type { DebugSection } from "../playerDebugTypes";
import type { DebugAction, DebugStatus } from "./debugActionTypes";

/**
 * Le diagnostic en TEXTE, pour le coller dans un message : la coquille, l'état de chaque
 * action, puis chaque section. C'est ce qu'on envoie quand on essaie sur une machine que
 * personne d'autre n'a sous la main (Windows, Linux).
 */
export function debugReport(shell: string, sections: readonly DebugSection[], actions: readonly DebugAction[], statuses: ReadonlyMap<string, DebugStatus>): string {
  const lines: string[] = [`Tentacle — diagnostic (${shell}) — ${new Date().toISOString()}`, "", "ACTIONS"];
  for (const action of actions) {
    const status = statuses.get(action.id);
    const state = status?.unavailable !== undefined ? `indisponible — ${status.unavailable}`
      : [status?.on === undefined ? null : status.on ? "allumé" : "coupé", status?.value].filter(Boolean).join(" · ") || "disponible";
    lines.push(`  [${action.key.toUpperCase()}] ${action.label} : ${state}`);
  }
  for (const section of sections) {
    lines.push("", section.title.toUpperCase());
    for (const [key, value, state] of section.lines) lines.push(`  ${key} : ${value}${state === false ? "   ← à voir" : ""}`);
  }
  return lines.join("\n");
}

/** Copie dans le presse-papiers ; rend faux si la page n'en a pas le droit. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Sans l'API (contexte non sûr, coquille sans presse-papiers asynchrone) : une zone de texte.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
