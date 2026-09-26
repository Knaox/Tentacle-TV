/** Le caractère retenu d'une case : dernière frappe, capitale, alphanumérique. */
export function sanitizeCodeChar(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
}

/** Un code collé : les 4 caractères, ou `null` s'il n'en a pas assez. */
export function parsePastedCode(text: string): string[] | null {
  const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return code.length === 4 ? code.split("") : null;
}

/**
 * Le message d'un échec de jumelage (même tri que l'app et le bureau) :
 * code inconnu, expiré ou déjà pris → « code invalide » ; le reste → relais.
 */
export function pairErrorKey(message: string): "codeInvalid" | "relayError" {
  if (/404|invalide|expire|409|utilise/.test(message)) return "codeInvalid";
  return "relayError";
}
