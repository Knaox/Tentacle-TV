/**
 * La version affichée par « À propos » : la constante de build du web, sans son
 * suffixe de pré-version (« 1.4.0-beta.2 » → « 1.4.0 »), comme la page du
 * bureau. L'app affiche aussi un numéro de build natif, que le web n'a pas.
 */
export function displayVersion(raw: string): string {
  return raw.replace(/-[a-z]+(\..+)?$/i, "");
}
