import { isSetupUrl, type PluginSetupField, type PluginSetupMeta, type PluginSetupResult } from "@tentacle-tv/shared";
import { localized } from "../jellyfin/compatPresentation";

/**
 * Le formulaire `setup` d'une extension, en logique pure : ce qui cloche dans
 * un champ avant tout envoi, et la phrase qui dit le verdict du test — dans
 * les mots du plugin quand il les donne (`success`, `errors`), sinon dans
 * ceux de Tentacle.
 */

export type FieldProblem = "required" | "invalid" | null;

/** Un secret déjà enregistré peut rester vide : il est gardé. */
export function fieldProblem(field: PluginSetupField, value: string, storedSecret: boolean): FieldProblem {
  const typed = value.trim();
  if (!typed) return field.required && !(field.kind === "secret" && storedSecret) ? "required" : null;
  if (field.kind === "url" && !isSetupUrl(typed)) return "invalid";
  return null;
}

/** Les valeurs à envoyer : rognées, un secret vide gardé tel quel (le serveur complète). */
export const trimValues = (values: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));

export type SetupMessage = { text: string } | { key: string; values?: Record<string, string> };

export function resultMessage(meta: PluginSetupMeta, result: PluginSetupResult, language: string): SetupMessage {
  if (result.ok) {
    if (meta.success) {
      const template = localized(meta.success, language);
      return { text: result.version ? template.replace(/\{\{version\}\}/g, result.version) : template.replace(/\s*\{\{version\}\}/g, "") };
    }
    return result.version ? { key: "setupOkVersion", values: { version: result.version } } : { key: "setupOk" };
  }
  const own = result.error ? meta.errors[result.error] : undefined;
  if (own) return { text: localized(own, language) };
  return { key: result.error === "plugin-not-running" ? "setupNotRunning" : "setupFailed" };
}
