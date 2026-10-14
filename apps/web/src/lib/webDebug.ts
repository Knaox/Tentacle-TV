import { isDesktopApp } from "../desktop/detect";

/**
 * La SEULE porte d'exécution des outils de débogage du client web.
 *
 * Trois façons de l'ouvrir :
 *  - `import.meta.env.DEV` — le serveur de développement de Vite ;
 *  - `__PLAYER_DEBUG__` — un build instrumenté (`build:web:debug`, la coquille
 *    de bureau de développement) ;
 *  - le DRAPEAU DU SERVEUR — l'administrateur a posé `TENTACLE_WEB_DEBUG=on`,
 *    et le serveur marque la page du client web qu'il sert d'un attribut sur
 *    `<html>` (`apps/backend/src/static/webDebug.ts`).
 *
 * Le drapeau du serveur ne vaut que dans un NAVIGATEUR : l'app de bureau charge
 * sa propre page et ne le reçoit jamais, mais elle l'ignore aussi par principe.
 * Aucun paramètre d'adresse ne l'allume : un visiteur ne peut rien y faire.
 *
 * Coût quand tout est fermé : un attribut lu, un booléen. Les outils vivent
 * dans des morceaux chargés à la demande (`dev/webDebugBoot.ts`).
 */

/**
 * ⚠️ Nom d'attribut qui traverse le réseau : le serveur l'écrit, le client le
 * lit. Ne jamais le renommer d'un seul côté (même valeur dans le backend).
 */
export const WEB_DEBUG_ATTRIBUTE = "data-tentacle-web-debug";

/** Ce dont la porte décide — entré par les paramètres, pour se tester sans navigateur. */
export interface WebDebugInputs {
  /** `import.meta.env.DEV`. */
  dev: boolean;
  /** `__PLAYER_DEBUG__`, figé au build. */
  instrumented: boolean;
  /** La coquille de bureau (`isDesktopApp()`). */
  desktop: boolean;
  /** La valeur de l'attribut sur `<html>`, ou `null`. */
  serverAttribute: string | null;
}

/** La règle : un build de développement ou instrumenté, sinon le drapeau du serveur — hors coquille de bureau. */
export function webDebugAllowed(inputs: WebDebugInputs): boolean {
  if (inputs.dev || inputs.instrumented) return true;
  return !inputs.desktop && inputs.serverAttribute === "on";
}

function readServerAttribute(): string | null {
  try {
    return document.documentElement.getAttribute(WEB_DEBUG_ATTRIBUTE);
  } catch {
    return null;
  }
}

/** Les outils de débogage du web sont-ils permis ? */
export function isWebDebugEnabled(): boolean {
  // Les deux drapeaux de compilation d'abord, en littéraux : un build livré
  // ne garde que la lecture de l'attribut.
  if (import.meta.env.DEV) return true;
  if (typeof __PLAYER_DEBUG__ !== "undefined" && __PLAYER_DEBUG__) return true;
  return webDebugAllowed({
    dev: false,
    instrumented: false,
    desktop: isDesktopApp(),
    serverAttribute: readServerAttribute(),
  });
}
