/**
 * Politique de sécurité du contenu, sans `unsafe-inline` sur les scripts.
 *
 * # Pourquoi ce fichier existe
 *
 * `index.html` porte un script INLINE indispensable : il pose `data-theme` et
 * un fond opaque AVANT le premier paint. Le reporter après le chargement du
 * bundle réintroduirait le flash clair/sombre à chaque ouverture — et sur une
 * fenêtre de bureau déjà peinte, ça se voit beaucoup.
 *
 * La solution paresseuse serait `script-src 'unsafe-inline'`, ce que faisait
 * la CSP héritée de Tauri. Mais `unsafe-inline` autorise TOUT script injecté :
 * c'est précisément la protection qu'on veut. On calcule donc l'empreinte
 * SHA-256 des scripts inline réellement présents dans le HTML servi, et on
 * n'autorise QUE celles-là. Le calcul se fait au démarrage : le jour où le
 * script change, l'empreinte suit toute seule.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Empreintes des scripts inline d'un document HTML, prêtes pour la CSP. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  // Scripts SANS attribut `src` : eux seuls sont concernés par script-src
  // en tant que contenu inline.
  const pattern = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const body = match[1];
    if (body === undefined || body.trim() === "") continue;
    const digest = createHash("sha256").update(body, "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

/** Lit le HTML et en tire les empreintes. Tableau vide si illisible. */
export function hashesFromFile(indexHtmlPath: string): string[] {
  try {
    return inlineScriptHashes(readFileSync(indexHtmlPath, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Assemble la politique.
 *
 * `img-src`, `media-src` et `connect-src` restent larges : l'utilisateur
 * saisit l'adresse d'un serveur Jellyfin quelconque, souvent une IP privée en
 * HTTP simple. C'est inhérent au produit, pas un relâchement.
 *
 * Le reste se resserre par rapport à la CSP Tauri :
 *  - `script-src` perd `unsafe-inline` et `cdn.tailwindcss.com`
 *  - `object-src`, `base-uri`, `form-action`, `frame-ancestors` sont fermés
 */
export function buildCsp(appOrigin: string, scriptHashes: readonly string[]): string {
  const scriptSrc = ["'self'", appOrigin, ...scriptHashes].join(" ");
  return [
    `default-src 'self' ${appOrigin}`,
    `script-src ${scriptSrc}`,
    // Les styles inline restent nécessaires : Tailwind et Framer Motion
    // écrivent dans l'attribut `style`, qu'aucune empreinte ne couvre.
    `style-src 'self' 'unsafe-inline' ${appOrigin} https://fonts.googleapis.com`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob: data: https: http:",
    "connect-src 'self' https: http: ws: wss:",
    // Bandes-annonces YouTube. `http:` et `https:` sont nécessaires en plus des
    // domaines YouTube : sur une origine applicative, l'embed direct n'a pas de
    // referrer HTTP valide et YouTube répond 153. L'app passe donc par une page
    // relais servie par le serveur Tentacle de l'utilisateur — dont l'adresse
    // est quelconque, souvent une IP privée en HTTP simple. Même raison que
    // pour `img-src` et `media-src` : c'est inhérent au produit.
    "frame-src 'self' blob: https: http:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
