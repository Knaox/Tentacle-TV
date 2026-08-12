/**
 * Le script de démarrage d'un plugin dans la WebView mobile : dépendances
 * partagées (React 19, TanStack Query, i18next), `window.__tentacle`, montage
 * de la route demandée puis injection du bundle IIFE.
 *
 * Extrait de `pluginHtmlTemplate` — qui décrit le DOCUMENT (thème, tokens,
 * styles) là où celui-ci décrit son EXÉCUTION. Le host web sépare déjà les deux
 * de la même façon (`pluginIframe/buildPluginBridge.ts`).
 */

interface BootstrapParams {
  backendUrl: string;
  lang: string;
  pluginPath: string;
  /** Bundle IIFE déjà échappé pour insertion dans un template literal JS. */
  escapedBundle: string;
}

/** Contenu du `<script>` final (sans les balises). */
export function buildPluginBootstrapScript({
  backendUrl,
  lang,
  pluginPath,
  escapedBundle,
}: BootstrapParams): string {
  return `
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
  `;
}
