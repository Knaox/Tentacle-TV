import type { AppTheme } from "../theme/palette.types";
import { buildPluginBootstrapScript } from "./pluginBootstrapScript";
import {
  buildPluginThemeVars,
  buildPluginTokenCss,
  PLUGIN_TENTACLE_COLORS,
  PLUGIN_TW_EXTEND,
  type PluginThemeVars,
} from "./pluginThemeTokens";

/**
 * Construction du HTML de la WebView plugin. Les tokens de thème (palette legacy
 * + vocabulaire sémantique complet + config Tailwind) vivent dans
 * ./pluginThemeTokens. Ré-export back-compat : PluginWebView importe encore
 * buildPluginThemeVars / PluginThemeVars depuis ce module.
 */
export { buildPluginThemeVars, type PluginThemeVars };

interface BuildPluginHtmlParams {
  backendUrl: string;
  token: string;
  userJson: string;
  lang: string;
  bundleCode: string;
  sharedDepsCode: string;
  pluginPath: string;
  /** Thème mobile actif : la palette WebView COMPLÈTE en est dérivée. */
  appTheme: AppTheme;
  /**
   * Hauteur du chrome de l'application qui FLOTTE au-dessus de la WebView, en
   * bas (barre d'onglets en verre). La WebView descend jusqu'au bord de
   * l'écran : un plugin n'a aucun moyen de la deviner, et tout ce qu'il ancre
   * en bas — pied de panneau, feuille, toast — se retrouverait dessous.
   * Publiée en `--tentacle-chrome-bottom`. Rien en haut : le cadre est déjà
   * décalé du header (`paddingTop`).
   */
  chromeBottom?: number;
}

/**
 * Construit le HTML complet pour exécuter un plugin IIFE dans une WebView.
 * Les dépendances partagées (React 19, ReactDOM 19, TanStack Query, i18next)
 * sont chargées via <script src> depuis le backend (pas d'auth requise).
 */
export function buildPluginHtml({
  backendUrl,
  token,
  userJson,
  lang,
  bundleCode,
  sharedDepsCode,
  pluginPath,
  appTheme,
  chromeBottom = 0,
}: BuildPluginHtmlParams): string {
  const theme = buildPluginThemeVars(appTheme);
  // Vocabulaire de tokens sémantique complet, dérivé du thème actif (clair/sombre).
  const tokenCss = buildPluginTokenCss(appTheme);

  // Échapper le code du bundle pour insertion dans un template literal JS
  const escapedBundle = bundleCode
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  // Échapper </script> dans le code des shared-deps pour éviter de casser le HTML
  const safeDepsCode = sharedDepsCode.replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            tentacle: Object.assign({
              bg: ${JSON.stringify(theme.bg)},
              surface: ${JSON.stringify(theme.surface)},
              border: ${JSON.stringify(theme.border)},
              accent: ${JSON.stringify(theme.accent)},
              "accent-dark": ${JSON.stringify(theme.accentDark)},
              "accent-light": ${JSON.stringify(theme.accentLight)},
              "accent-muted": ${JSON.stringify(theme.accentMuted)},
            }, ${JSON.stringify(PLUGIN_TENTACLE_COLORS)}),
          },
          borderRadius: ${JSON.stringify(PLUGIN_TW_EXTEND.borderRadius)},
          boxShadow: ${JSON.stringify(PLUGIN_TW_EXTEND.boxShadow)},
          backdropBlur: ${JSON.stringify(PLUGIN_TW_EXTEND.backdropBlur)},
          transitionTimingFunction: ${JSON.stringify(PLUGIN_TW_EXTEND.transitionTimingFunction)},
          transitionDuration: ${JSON.stringify(PLUGIN_TW_EXTEND.transitionDuration)},
          animation: ${JSON.stringify(PLUGIN_TW_EXTEND.animation)},
          keyframes: {
            shimmer: {
              "0%": { backgroundPosition: "-200% 0" },
              "100%": { backgroundPosition: "200% 0" },
            },
            fadeSlideUp: {
              from: { opacity: "0", transform: "translateY(20px)" },
              to: { opacity: "1", transform: "translateY(0)" },
            },
            fadeSlideDown: {
              from: { opacity: "0", transform: "translateY(-10px)" },
              to: { opacity: "1", transform: "translateY(0)" },
            },
            scaleIn: {
              from: { opacity: "0", transform: "scale(0.95)" },
              to: { opacity: "1", transform: "scale(1)" },
            },
            slideInRight: {
              from: { opacity: "0", transform: "translateX(30px)" },
              to: { opacity: "1", transform: "translateX(0)" },
            },
            pulseGlow: {
              "0%, 100%": { opacity: "0.4" },
              "50%": { opacity: "0.8" },
            },
            breathe: {
              "0%, 100%": { boxShadow: "0 0 15px ${theme.accentGlowSoft}" },
              "50%": { boxShadow: "0 0 25px ${theme.accentGlowStrong}" },
            },
          },
        },
      },
    };
  <\/script>
  <style>
    ${tokenCss}
    :root {
      --bg: ${theme.bg};
      --surface: ${theme.surface};
      --accent: ${theme.accent};
      --text: ${theme.text};
      /* Ce que la barre d'onglets flottante recouvre en bas du cadre. */
      --tentacle-chrome-bottom: ${Math.max(0, Math.round(chromeBottom))}px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #plugin-root { min-height: 100vh; }
    ::-webkit-scrollbar { display: none; }
    .plugin-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: var(--text-secondary);
      font-size: 14px;
    }
    .plugin-error {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: ${theme.error};
      font-size: 14px;
      padding: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="plugin-root">
    <div class="plugin-loading">Loading plugin…</div>
  </div>

  <script>
    // Capturer toute erreur non-catchée (y compris dans le shared-deps inline)
    window.onerror = function(msg, url, line, col, err) {
      var stack = err && err.stack ? "\\n" + err.stack.split("\\n").slice(0, 6).join("\\n") : "";
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: "ERROR", message: "Uncaught: " + msg + " (line " + line + ":" + col + ")" + stack
      }));
    };
    // Perf timings (envoyés au bridge en dev)
    var __perf = { start: performance.now() };
    // Injecter auth dans localStorage avant tout
    try {
      localStorage.setItem('tentacle_token', ${JSON.stringify(token)});
      localStorage.setItem('tentacle_server_url', ${JSON.stringify(backendUrl)});
      localStorage.setItem('tentacle_language', ${JSON.stringify(lang)});
      var userJson = ${JSON.stringify(userJson)};
      if (userJson) localStorage.setItem('tentacle_user', userJson);
    } catch(e) {}
  <\/script>

  <!-- Shared deps inlinées (WKWebView bloque les requêtes HTTP depuis origin null) -->
  <script>${safeDepsCode}<\/script>

  <script>${buildPluginBootstrapScript({ backendUrl, lang, pluginPath, escapedBundle })}<\/script>
</body>
</html>`;
}
