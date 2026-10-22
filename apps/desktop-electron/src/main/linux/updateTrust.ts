/**
 * Ce que le processus principal exige avant de télécharger ou d'installer une
 * mise à jour Linux.
 *
 * URL, empreinte et chemin arrivent de la PAGE, par IPC. La page lit le
 * manifeste sur GitHub et n'a aucune raison de les tordre ; mais un rendu
 * compromis (XSS, greffon qui s'échapperait) le pourrait, et `install` finit
 * en `pkexec` ou en remplacement de l'exécutable. Le principal ne croit donc
 * la page que dans des bornes qu'il tient lui-même :
 *
 *  - le binaire ne vient QUE des Releases du dépôt, en HTTPS ;
 *  - l'empreinte est obligatoire et bien formée — vide, elle sautait la
 *    vérification ;
 *  - seul un fichier que le principal a lui-même téléchargé et vérifié
 *    s'installe.
 */

/** Préfixe des binaires publiés — celui que construit `apps/web/src/lib/linuxUpdate.ts`. */
const RELEASE_HOST = "github.com";
const RELEASE_PATH_PREFIX = "/knaox/tentacle-tv/releases/download/";

/** L'URL désigne-t-elle un fichier des Releases du dépôt, en HTTPS ? */
export function isTrustedReleaseUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === RELEASE_HOST &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    // GitHub ne distingue pas la casse du propriétaire ni du dépôt.
    url.pathname.toLowerCase().startsWith(RELEASE_PATH_PREFIX)
  );
}

/** Une empreinte SHA-256 en hexadécimal, rien d'autre. */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * Chemins téléchargés ET vérifiés par ce processus.
 *
 * En mémoire seulement : un redémarrage entre téléchargement et installation
 * redemande le téléchargement, ce que la page fait déjà.
 */
const verified = new Set<string>();

export function rememberVerified(localPath: string): void {
  verified.add(localPath);
}

export function isVerified(localPath: string): boolean {
  return verified.has(localPath);
}
