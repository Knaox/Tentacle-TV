interface BuildPluginHtmlParams {
  backendUrl: string;
  token: string;
  userJson: string;
  lang: string;
  bundleCode: string;
  sharedDepsCode: string;
  pluginPath: string;
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
}: BuildPluginHtmlParams): string {
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
            tentacle: {
              bg: "#080812",
              surface: "#12121a",
              border: "#1e1e2e",
              accent: "#8b5cf6",
              "accent-dark": "#7C3AED",
              "accent-light": "#a78bfa",
              "accent-muted": "#C4B5FD",
            },
          },
          animation: {
            shimmer: "shimmer 1.5s ease infinite",
            "fade-slide-up": "fadeSlideUp 0.5s ease both",
            "fade-slide-down": "fadeSlideDown 0.3s ease both",
            "scale-in": "scaleIn 0.2s ease both",
            "slide-in-right": "slideInRight 0.25s ease both",
            "pulse-glow": "pulseGlow 2s ease infinite",
            breathe: "breathe 2s ease infinite",
          },
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
              "0%, 100%": { boxShadow: "0 0 15px rgba(139,92,246,0.3)" },
              "50%": { boxShadow: "0 0 25px rgba(139,92,246,0.5)" },
            },
          },
        },
      },
    };
  <\/script>
  <style>
    :root {
      --bg: #080812;
      --surface: #12121a;
      --accent: #8b5cf6;
      --text: #fff;
      --text-secondary: #9ca3af;
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
      color: #ef4444;
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

  <script>
    __perf.sharedDepsLoaded = performance.now();
    (async function() {
      try {
        var deps = window.__SHARED_DEPS__;
        if (!deps) throw new Error("shared-deps.js failed to initialize — window.__SHARED_DEPS__ is undefined");

        var React = deps.React;
        var JSXRuntime = deps.JSXRuntime;
        var ReactDOMClient = deps.ReactDOMClient;
        var TQ = deps.TQ;
        var RI = deps.RI;

        var i18n = deps.i18next.createInstance();
        await i18n.use(RI.initReactI18next).init({
          lng: ${JSON.stringify(lang)},
          fallbackLng: "en",
          resources: {},
          interpolation: { escapeValue: false },
        });

        __perf.i18nReady = performance.now();
        window.TentacleShared = {
          React: React,
          ReactJSXRuntime: JSXRuntime,
          TanStackQuery: TQ,
          ReactI18next: RI,
          PluginsAPI: {},
          i18n: i18n,
        };

        var queryClient = new TQ.QueryClient({
          defaultOptions: { queries: { staleTime: 60000, retry: 1 } },
        });

        var pluginPath = ${JSON.stringify(pluginPath)};

        window.__tentacle = {
          backendUrl: ${JSON.stringify(backendUrl)},
          async registerPlugin(plugin) {
            try {
              if (plugin.initialize) await plugin.initialize();
              if (plugin.isConfigured) {
                var configured = await plugin.isConfigured();
                if (configured === false) {
                  document.getElementById("plugin-root").innerHTML =
                    '<div class="plugin-error">Plugin not configured</div>';
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: "ERROR", message: "Plugin not configured",
                  }));
                  return;
                }
              }

              var route = plugin.routes?.find(function(r) { return r.path === pluginPath; });
              if (!route) {
                document.getElementById("plugin-root").innerHTML =
                  '<div class="plugin-error">Route not found: ' + pluginPath + '</div>';
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: "ERROR", message: "Route not found: " + pluginPath,
                }));
                return;
              }

              var root = ReactDOMClient.createRoot(document.getElementById("plugin-root"));
              root.render(
                React.createElement(TQ.QueryClientProvider, { client: queryClient },
                  React.createElement(RI.I18nextProvider, { i18n: i18n },
                    React.createElement(React.Suspense,
                      { fallback: React.createElement("div", { className: "plugin-loading" }, "Loading…") },
                      React.createElement(route.component)
                    )
                  )
                )
              );

              __perf.rendered = performance.now();
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "READY" }));
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: "PERF_TIMINGS",
                timings: {
                  sharedDeps: Math.round(__perf.sharedDepsLoaded - __perf.start),
                  i18nInit: Math.round(__perf.i18nReady - __perf.sharedDepsLoaded),
                  bundleInject: Math.round(__perf.afterBundle - __perf.beforeBundle),
                  render: Math.round(__perf.rendered - __perf.afterBundle),
                  total: Math.round(__perf.rendered - __perf.start),
                },
              }));
            } catch (err) {
              document.getElementById("plugin-root").innerHTML =
                '<div class="plugin-error">' + (err.message || "Plugin error") + '</div>';
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: "ERROR", message: String(err),
              }));
            }
          },
          unregisterPlugin: function() {},
        };

        // Injecter le bundle IIFE
        __perf.beforeBundle = performance.now();
        var script = document.createElement("script");
        script.textContent = \`${escapedBundle}\`;
        document.head.appendChild(script);
        __perf.afterBundle = performance.now();
      } catch (err) {
        document.getElementById("plugin-root").innerHTML =
          '<div class="plugin-error">Failed to load dependencies: ' + (err.message || err) + '</div>';
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: "ERROR", message: "Deps loading failed: " + String(err),
        }));
      }
    })();
  <\/script>
</body>
</html>`;
}
