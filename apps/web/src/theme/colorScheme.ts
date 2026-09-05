/**
 * Mode d'apparence (clair / sombre / auto) — store et persistance.
 *
 * Réglage PAR APPAREIL (`localStorage`), comme le réglage d'apparence de l'OS.
 * Les jetons eux-mêmes vivent dans `tokens.css`, qui redéclare les couleurs
 * sous `:root[data-theme="light"]` : ce module ne fait que poser l'attribut.
 *
 * DÉTECTION OS — `matchMedia('(prefers-color-scheme: dark)')` est le signal
 * primaire, et le seul. Vérifié : il suit l'OS dans les deux webviews Tauri
 * (WKWebView hérite de l'apparence NSApp ; WebView2 suit le thème Windows), et
 * il fonctionne aussi en navigateur — un seul chemin de code pour les quatre
 * cibles. On n'utilise DÉLIBÉRÉMENT pas `getCurrentWindow().theme()` de Tauri :
 * la permission `core:window:allow-theme` n'est pas accordée dans
 * `capabilities/default.json`, et l'API a un historique de fiabilité inégal
 * hors Windows (tao #387). L'éviter, c'est zéro modification d'ACL — donc zéro
 * re-review MSIX ou App Store.
 *
 * L'amorçage se fait dans le <script> inline de `index.html`, AVANT le premier
 * paint. Ce module se contente de reprendre la valeur déjà posée sur <html>.
 */

import {
  resolveScheme,
  sanitizeThemeMode,
  type ResolvedScheme,
  type ThemeMode,
} from "@tentacle-tv/theme";

export const THEME_MODE_STORAGE_KEY = "tentacle_theme_mode";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const prefersDark = (): boolean => {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return true; // rendu historique de l'app
  }
};

const readStoredMode = (): ThemeMode => {
  try {
    return sanitizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY));
  } catch {
    // Même défaut que `sanitizeThemeMode` : sombre. Les deux doivent dire la
    // même chose, sinon un stockage illisible ferait basculer le thème.
    return "dark";
  }
};

let mode: ThemeMode = readStoredMode();
let scheme: ResolvedScheme = resolveScheme(mode, prefersDark());

const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};

/** Écrit l'attribut lu par `:root[data-theme="light"]` dans `tokens.css`. */
const applyToDocument = (next: ResolvedScheme): void => {
  document.documentElement.setAttribute("data-theme", next);
  // Aligne les contrôles natifs du webview (scrollbars, champs de formulaire,
  // menus) sur le schéma : sans ça une scrollbar sombre subsiste en clair.
  document.documentElement.style.colorScheme = next;
};

const recompute = (): void => {
  const next = resolveScheme(mode, prefersDark());
  if (next === scheme) return;
  scheme = next;
  applyToDocument(next);
  emit();
};

/**
 * Réagit EN DIRECT au changement de thème de l'OS, sans redémarrage. N'a
 * d'effet visible qu'en mode auto — `recompute` court-circuite sinon, puisque
 * `resolveScheme` ignore le système pour un mode forcé.
 */
try {
  window.matchMedia(DARK_QUERY).addEventListener("change", recompute);
} catch {
  /* matchMedia absent : on reste sur la valeur d'amorçage. */
}

export const getMode = (): ThemeMode => mode;
export const getScheme = (): ResolvedScheme => scheme;

export function setMode(next: ThemeMode): void {
  mode = next;
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
  } catch {
    /* Persistance impossible : le choix vaut pour la session en cours. */
  }
  const resolved = resolveScheme(next, prefersDark());
  scheme = resolved;
  applyToDocument(resolved);
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Resynchronise le store avec l'attribut déjà posé par le script d'amorçage.
 * Appelé une fois au boot : couvre le cas où `localStorage` aurait changé entre
 * le script inline et l'évaluation de ce module.
 */
export function syncFromDocument(): void {
  applyToDocument(scheme);
}

/**
 * Retire le fond opaque pose en ligne par le script d'amorcage de `index.html`.
 *
 * Ce fond existe pour qu'une fenetre Tauri `transparent: true` ne laisse pas
 * voir le bureau avant que la feuille de style ne soit appliquee. Une fois
 * l'app montee, le CSS prend le relais via `--surface-0` : on doit liberer le
 * style inline, sinon il FIGERAIT le fond et neutraliserait la bascule
 * clair/sombre.
 */
export function releaseBootBackground(): void {
  document.documentElement.style.background = "";
}
