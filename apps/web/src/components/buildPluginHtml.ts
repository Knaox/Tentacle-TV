// Assemblage du document HTML de l'iframe plugin. Les trois briques vivent
// dans pluginIframe/ : thème (config Tailwind + <style>, buildPluginTheme) et
// scripts runtime (bridge + bootstrap, buildPluginBridge) — découpe imposée
// par la règle « 300 lignes max par fichier », comportement identique.
import { buildPluginTailwindConfigScript, buildPluginThemeStyle } from "./pluginIframe/buildPluginTheme";
import { buildPluginBridgeScript, buildPluginBootstrapScript } from "./pluginIframe/buildPluginBridge";
import type { PluginHostEnv } from "./pluginIframe/buildPluginBridge";
import { isDesktopApp } from "../desktop/bridge";

interface BuildPluginHtmlParams {
  backendUrl: string;
  lang: string;
  pluginPath: string;
  /** Query string de l'URL hôte (« ?media=movie:603 ») — le deep-link du
   *  plugin. L'iframe n'a pas accès à l'URL parente, on la lui transmet. */
  pluginQuery: string;
  sharedDepsCode: string;
  tailwindCode: string;
}

/**
 * Build the full HTML document for a sandboxed plugin iframe.
 * Shared deps (React 19, ReactDOM, TanStack Query, i18next) are inlined
 * from the pre-built shared-deps.js bundle.
 * The plugin IIFE bundle is fetched and injected at runtime via postMessage.
 * No auth tokens are passed — API requests go through the host via postMessage bridge.
 */
export function buildPluginHtml({
  backendUrl,
  lang,
  pluginPath,
  pluginQuery,
  sharedDepsCode,
  tailwindCode,
}: BuildPluginHtmlParams): string {
  // Escape </script> in inlined code to avoid breaking the HTML
  const safeDepsCode = sharedDepsCode.replace(/<\/script/gi, "<\\/script");
  const safeTailwindCode = tailwindCode.replace(/<\/script/gi, "<\\/script");

  // Environnement hôte exposé aux plugins (iframe sandboxée = aucun accès à la
  // window parente ni aux marqueurs du shell). Permet de répliquer les
  // comportements plateforme du core (ex: trailers YouTube sur macOS DMG).
  const hostEnv: PluginHostEnv = {
    // ⚠️ Conservé, et figé à faux. C'est une API PUBLIQUE : des greffons tiers
    // lisent ce drapeau, et le retirer casserait ceux qui le consultent. Il n'y
    // a simplement plus de coquille Tauri à annoncer.
    tauri: false,
    desktop: isDesktopApp(),
    mac: typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent),
    prod: import.meta.env.PROD,
    backendUrl,
    query: pluginQuery,
  };

  // Propage le schema de l'hote a l'iframe. Le markup des plugins (Seer) est
  // concu sombre-only avec des classes `white`/`black` en dur et le bundle est
  // intouchable (regle projet) — l'adaptation se fait donc COTE HOTE : c'est
  // nous qui fournissons la config du runtime Tailwind de l'iframe, on y
  // redefinit `white` et `black` comme canaux RGB pilotes par `data-theme`
  // (voir buildPluginThemeStyle). En clair, chaque text-white/70, bg-white/5
  // ou border-white/10 du plugin resout vers de l'encre — alphas preserves —
  // sans modifier une ligne du bundle. Snapshot au build du srcdoc ; une
  // bascule en cours de session s'applique au prochain montage.
  const currentTheme =
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  return `<!DOCTYPE html>
<html data-theme="${currentTheme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>${safeTailwindCode}<\/script>
  <script>${buildPluginTailwindConfigScript()}<\/script>
  <style>${buildPluginThemeStyle()}</style>
</head>
<body>
  <div id="plugin-root">
    <div class="plugin-loading">
      <div class="logo-wrap">
        <img src="${backendUrl}/tentacle-logo-pirate.svg" alt="Tentacle" onerror="this.style.display='none'">
        <div class="spinner"></div>
      </div>
      <span>${lang === "fr" ? "Chargement du plugin…" : "Loading plugin…"}</span>
    </div>
  </div>

  <script>${buildPluginBridgeScript({ backendUrl, hostEnv })}<\/script>

  <!-- Shared deps inlined (sandboxed iframe cannot access parent window) -->
  <script>${safeDepsCode}<\/script>

  <script>${buildPluginBootstrapScript({ backendUrl, lang, pluginPath })}<\/script>
</body>
</html>`;
}
