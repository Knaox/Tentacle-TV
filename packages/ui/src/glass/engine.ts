/**
 * Détection du moteur de rendu, pour choisir le niveau de verre.
 *
 * POURQUOI PAS `CSS.supports` — c'est le piège de ce sujet. WebKit ACCEPTE
 * `backdrop-filter: url(#f)` au parsing (donc `CSS.supports` renvoie true)
 * puis ABANDONNE silencieusement la partie SVG au rendu, ne laissant qu'un
 * flou plat (bug WebKit 245510). Une feature-detection classique donnerait
 * donc un faux positif et on afficherait un verre dégradé en croyant l'inverse.
 *
 * On détecte donc le MOTEUR, ce qui est déterministe :
 *  - Windows (Tauri)  → WebView2 = Chromium  → filtre SVG exécuté
 *  - macOS  (Tauri)   → WKWebView = WebKit   → ignoré
 *  - Linux  (Tauri)   → WebKitGTK = WebKit   → ignoré
 *  - Navigateurs      → Chrome/Edge oui, Safari/Firefox non
 */

/** true si le moteur exécute un filtre SVG passé à `backdrop-filter`. */
export function supportsBackdropSvgFilter(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Chromium expose "Chrome/" ou "Chromium/". WebKit expose "Safari/" SANS
  // "Chrome/" — l'ordre du test compte, Chrome annonce aussi "Safari/".
  const chromium = /Chrom(e|ium)\//.test(ua);
  if (!chromium) return false;
  // Firefox n'implémente pas non plus les filtres SVG en backdrop-filter, et
  // n'annonce jamais Chrome — le test précédent l'exclut déjà.
  return true;
}

/** true si `backdrop-filter` (même sans SVG) est utilisable. */
export function supportsBackdropFilter(): boolean {
  if (typeof CSS === "undefined" || !CSS.supports) return false;
  // Ici `CSS.supports` est fiable : ce sont les fonctions de filtre standard,
  // que WebKit implémente réellement (avec le préfixe -webkit-).
  return (
    CSS.supports("backdrop-filter", "blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter", "blur(1px)")
  );
}

export type GlassLevel = "refraction" | "blur" | "flat";

/**
 * Niveau effectivement rendu :
 *  - `refraction` : flou + réfraction SVG (Chromium)
 *  - `blur`       : flou + saturation + spéculaire (WebKit, Firefox)
 *  - `flat`       : aucun backdrop-filter disponible → surface tokenisée opaque
 *
 * `flat` reste lisible : c'est la surface verre tokenisée, jamais une surface
 * nue — le contraste du texte est garanti dans les trois cas.
 */
export function resolveGlassLevel(enabled: boolean): GlassLevel {
  if (!supportsBackdropFilter()) return "flat";
  if (!enabled) return "blur";
  return supportsBackdropSvgFilter() ? "refraction" : "blur";
}
