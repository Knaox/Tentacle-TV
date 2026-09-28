/**
 * Durcissement, posé au démarrage et non ajouté après coup.
 *
 * La checklist officielle d'Electron compte 20 points ; 7 sont des réglages
 * par défaut, 13 demandent une action explicite. Ce fichier couvre ceux qui
 * ne dépendent pas d'une fenêtre précise.
 */

import { app, session, shell, type WebContents } from "electron";
import { isAppOrigin } from "./appProtocol";

/**
 * Schémas que l'application accepte d'ouvrir dans le navigateur du système.
 *
 * Liste FERMÉE : `shell.openExternal` peut exécuter des commandes si on lui
 * passe n'importe quoi (`file:`, schémas d'application). C'est un point de la
 * checklist Electron à lui tout seul.
 */
const EXTERNAL_SCHEMES = new Set([
  "http:",
  "https:",
  "mailto:",
  "ms-windows-store:",
  "macappstore:",
  "itms-apps:",
]);

/** Ouvre une URL à l'extérieur, ou refuse. Renvoie `true` si ouverte. */
export async function openExternalSafely(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!EXTERNAL_SCHEMES.has(parsed.protocol)) return false;
  await shell.openExternal(parsed.toString());
  return true;
}

/**
 * La seule permission web accordée : ÉCRIRE du texte dans le presse-papiers,
 * pour la page de l'application et elle seule.
 *
 * `navigator.clipboard.writeText` la demande (`clipboard-sanitized-write`). Tout
 * refuser la refusait aussi : mesuré sous Electron 43, l'appel rejetait
 * (« Write permission denied ») et chaque bouton « Copier » restait sans effet
 * — le lien de partage de Ma liste et des favoris le premier. Un navigateur
 * l'accorde d'office à une page au premier plan. L'écriture est « assainie »
 * (texte, HTML nettoyé, PNG) ; la LECTURE (`clipboard-read`) reste refusée.
 *
 * Cadre principal de `tentacle://app` seulement : ni un greffon (son origine
 * est `tentacle://plugin`), ni un cadre tiers (la bande-annonce YouTube) n'en
 * profitent.
 */
function isGranted(permission: string, requestingUrl: string, isMainFrame: boolean): boolean {
  return permission === "clipboard-sanitized-write" && isMainFrame && isAppOrigin(requestingUrl);
}

/**
 * Refuse toutes les permissions web, sauf l'écriture du presse-papiers
 * (`isGranted`).
 *
 * La documentation est explicite : « By default, Electron will automatically
 * approve all permission requests ». Un client média n'a besoin ni de caméra,
 * ni de micro, ni de géolocalisation, ni de notifications système.
 *
 * Les deux gestionnaires répondent la même chose : la demande
 * (`writeText`) et le contrôle (`navigator.permissions.query`), qui reçoit
 * l'origine de la page (`tentacle://app/`) là où la demande reçoit son URL.
 */
export function restrictPermissions(): void {
  const s = session.defaultSession;
  s.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(isGranted(permission, details.requestingUrl, details.isMainFrame)),
  );
  s.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) =>
    isGranted(permission, requestingOrigin, details.isMainFrame),
  );
  // Aucun périphérique (HID, série, USB) ne doit pouvoir être sélectionné.
  s.setDevicePermissionHandler(() => false);
}

/**
 * Verrouille la navigation d'un `WebContents`.
 *
 * L'origine applicative est la seule où la page a le droit d'aller. Toute
 * autre destination part dans le navigateur du système, jamais dans
 * l'application.
 */
export function lockNavigation(contents: WebContents): void {
  contents.on("will-navigate", (event, url) => {
    // `isAppOrigin`, jamais `URL.origin` : ce dernier vaut `"null"` sous Node
    // pour notre schéma, ce qui faisait passer CHAQUE navigation interne pour
    // un lien externe — et `openExternalSafely` la jetait ensuite, le schéma
    // `tentacle:` n'étant pas dans la liste. Cul-de-sac silencieux.
    if (!isAppOrigin(url)) {
      event.preventDefault();
      void openExternalSafely(url);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: "deny" };
  });

  // L'application n'utilise aucune <webview> : on refuse qu'il en naisse une,
  // et on retire au passage le preload et l'intégration Node qu'un attaquant
  // pourrait tenter d'y attacher.
  contents.on("will-attach-webview", (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    event.preventDefault();
    void params;
  });
}

/**
 * Applique une CSP aux réponses, choisie d'après l'URL.
 *
 * Le choix par URL n'est pas un raffinement : l'application et les greffons
 * vivent sous deux origines du même schéma et n'ont pas les mêmes besoins. La
 * page garde une politique par empreintes, sans `'unsafe-inline'` ; le document
 * d'un greffon, fait entièrement de scripts inline, reçoit la sienne. Une
 * politique unique aurait forcé à desserrer les deux pour satisfaire le plus
 * exigeant.
 *
 * `resolve` renvoie `null` pour laisser une réponse intacte — c'est le cas du
 * serveur Jellyfin de l'utilisateur, qui n'est pas à nous et dont on n'a pas à
 * réécrire les en-têtes.
 */
export function installContentSecurityPolicy(resolve: (url: string) => string | null): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = resolve(details.url);
    // Rappel SANS `responseHeaders` : Electron laisse alors la réponse telle
    // quelle. Repasser `details.responseHeaders` reviendrait au même, mais le
    // champ est facultatif et vaut `undefined` sur certaines réponses.
    if (csp === null) {
      callback({});
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

/**
 * Interdit une seconde instance.
 *
 * Deux processus qui ouvrent la même base SQLite et la même racine de
 * téléchargements, c'est de la corruption garantie.
 *
 * Renvoie `false` si une instance tourne déjà — l'appelant doit alors quitter.
 */
export function claimSingleInstance(onSecond: () => void): boolean {
  if (!app.requestSingleInstanceLock()) return false;
  app.on("second-instance", onSecond);
  return true;
}
