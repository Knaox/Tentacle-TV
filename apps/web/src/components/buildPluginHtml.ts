// CSS tokens du host injectés dans l'iframe pour que les plugins suivent automatiquement
// le thème (couleurs, blur, shadows, radii, motion). Si Tentacle change ses tokens.css,
// les plugins suivent au prochain rebuild — pas de couleurs hardcodées côté plugin.
import tentacleTokensCss from "../theme/tokens.css?inline";

interface BuildPluginHtmlParams {
  backendUrl: string;
  lang: string;
  pluginPath: string;
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
  sharedDepsCode,
  tailwindCode,
}: BuildPluginHtmlParams): string {
  // Escape </script> in inlined code to avoid breaking the HTML
  const safeDepsCode = sharedDepsCode.replace(/<\/script/gi, "<\\/script");
  const safeTailwindCode = tailwindCode.replace(/<\/script/gi, "<\\/script");

  // Environnement hôte exposé aux plugins (iframe sandboxée = aucun accès à
  // window parent ni à __TAURI_INTERNALS__). Permet de répliquer les
  // comportements plateforme du core (ex: trailers YouTube sur macOS DMG).
  const hostEnv = {
    tauri: typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    mac: typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent),
    prod: import.meta.env.PROD,
    backendUrl,
  };

  // Propage le schema clair/sombre de l'hote a l'iframe : le tokens.css inline
  // contient bien le bloc `:root[data-theme="light"]`, mais sans l'attribut sur
  // <html> il ne s'applique jamais — les plugins restaient sombres en clair.
  // Snapshot au build du srcdoc ; une bascule de theme en cours de session
  // s'appliquera au prochain montage du plugin.
  const currentTheme =
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  return `<!DOCTYPE html>
<html data-theme="${currentTheme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>${safeTailwindCode}<\/script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          // Couleurs sémantiques mappées sur les CSS variables Tentacle.
          // Utiliser bg-tentacle-surface-1 / text-tentacle-brand / border-tentacle-subtle
          // au lieu de classes hardcodées : si le thème change, le plugin suit.
          colors: {
            tentacle: {
              "surface-0": "var(--surface-0)",
              "surface-1": "var(--surface-1)",
              "surface-2": "var(--surface-2)",
              "surface-3": "var(--surface-3)",
              "surface-modal": "var(--surface-modal)",
              "surface-dropdown": "var(--surface-dropdown)",
              "surface-toolbar": "var(--surface-toolbar)",
              brand: "var(--brand)",
              "brand-light": "var(--brand-light)",
              "brand-dark": "var(--brand-dark)",
              "brand-accent": "var(--brand-accent)",
              "brand-soft": "var(--brand-soft)",
              "text-primary": "var(--text-primary)",
              "text-secondary": "var(--text-secondary)",
              "text-tertiary": "var(--text-tertiary)",
              "text-quaternary": "var(--text-quaternary)",
              "text-disabled": "var(--text-disabled)",
              "cta-primary": "var(--cta-primary-bg)",
              "cta-primary-fg": "var(--cta-primary-fg)",
              "cta-secondary": "var(--cta-secondary-bg)",
              "cta-secondary-fg": "var(--cta-secondary-fg)",
              "cta-ghost": "var(--cta-ghost-bg)",
              "border-subtle": "var(--border-subtle)",
              "border-strong": "var(--border-strong)",
              "border-focus": "var(--border-focus)",
              "status-success": "var(--status-success)",
              "status-success-bg": "var(--status-success-bg)",
              "status-success-fg": "var(--status-success-fg)",
              "status-warning": "var(--status-warning)",
              "status-warning-bg": "var(--status-warning-bg)",
              "status-warning-fg": "var(--status-warning-fg)",
              "status-error": "var(--status-error)",
              "status-error-bg": "var(--status-error-bg)",
              "status-error-fg": "var(--status-error-fg)",
              "status-info": "var(--status-info)",
              "status-info-bg": "var(--status-info-bg)",
              "status-info-fg": "var(--status-info-fg)",
              "fill-faint": "var(--fill-faint)",
              "fill-subtle": "var(--fill-subtle)",
              "fill-soft": "var(--fill-soft)",
              "fill-medium": "var(--fill-medium)",
              "fill-strong": "var(--fill-strong)",
              // Aliases rétro-compatibilité (anciens plugins)
              bg: "var(--surface-0)",
              surface: "var(--surface-1)",
              border: "var(--border-subtle)",
              accent: "var(--brand)",
              "accent-dark": "var(--brand-dark)",
              "accent-light": "var(--brand-light)",
              "accent-muted": "var(--brand-light)",
            },
          },
          borderRadius: {
            "tentacle-xs": "var(--radius-xs)",
            "tentacle-sm": "var(--radius-sm)",
            "tentacle-md": "var(--radius-md)",
            "tentacle-lg": "var(--radius-lg)",
            "tentacle-xl": "var(--radius-xl)",
            "tentacle-pill": "var(--radius-pill)",
          },
          boxShadow: {
            "tentacle-elev-1": "var(--elev-1)",
            "tentacle-elev-2": "var(--elev-2)",
            "tentacle-elev-3": "var(--elev-3)",
            "tentacle-modal": "var(--shadow-modal)",
            "tentacle-dropdown": "var(--shadow-dropdown)",
            "tentacle-sheet": "var(--shadow-sheet)",
          },
          backdropBlur: {
            "tentacle-overlay": "var(--blur-overlay)",
            "tentacle-modal": "var(--blur-modal)",
            "tentacle-dropdown": "var(--blur-dropdown)",
            "tentacle-sheet": "var(--blur-sheet)",
          },
          transitionTimingFunction: {
            "tentacle-out": "var(--ease-out)",
            "tentacle-in-out": "var(--ease-in-out)",
            "tentacle-spring": "var(--ease-spring)",
          },
          transitionDuration: {
            "tentacle-instant": "var(--duration-instant)",
            "tentacle-fast": "var(--duration-fast)",
            "tentacle-base": "var(--duration-base)",
            "tentacle-slow": "var(--duration-slow)",
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
    /* Tokens du host Tentacle — copiés depuis apps/web/src/theme/tokens.css à chaque build.
       Tout plugin peut désormais utiliser var(--brand), var(--surface-1), etc. */
    ${tentacleTokensCss}
    /* Aliases rétro-compatibilité pour anciens plugins */
    :root {
      --bg: var(--surface-0);
      --surface: var(--surface-1);
      --accent: var(--brand);
      --text: var(--text-primary);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--surface-0);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #plugin-root { min-height: 100vh; }
    .plugin-loading {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
      min-height: 100vh;
      color: var(--text-secondary);
      font-size: 14px;
    }
    .plugin-loading .logo-wrap {
      position: relative;
      animation: breathe-logo 2s ease infinite;
    }
    .plugin-loading .logo-wrap img { width: 64px; height: 64px; filter: drop-shadow(0 0 20px rgba(139,92,246,0.5)); }
    .plugin-loading .spinner {
      position: absolute; inset: -12px;
      border: 2px solid transparent;
      border-top-color: rgba(139,92,246,0.6);
      border-radius: 50%;
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes breathe-logo { 0%,100% { opacity: .8; } 50% { opacity: 1; } }
    .plugin-error {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 100vh;
      color: #ef4444;
      font-size: 14px;
      padding: 24px;
      text-align: center;
    }
    /* Scrollbar Tentacle — fine et violette */
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 3px; }
    *::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
    * { scrollbar-width: thin; scrollbar-color: rgba(139, 92, 246, 0.3) transparent; }
  </style>
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

  <script>
    // ── localStorage shim (sandboxed iframe blocks real localStorage) ──
    try { localStorage.getItem("_test"); } catch(e) {
      var _store = {};
      Object.defineProperty(window, "localStorage", { value: {
        getItem: function(k) { return _store.hasOwnProperty(k) ? _store[k] : null; },
        setItem: function(k, v) { _store[k] = String(v); },
        removeItem: function(k) { delete _store[k]; },
        clear: function() { _store = {}; },
        get length() { return Object.keys(_store).length; },
        key: function(i) { return Object.keys(_store)[i] || null; },
      }});
    }

    // ── Error handler ──
    window.onerror = function(msg, url, line, col, err) {
      var stack = err && err.stack ? "\\n" + err.stack.split("\\n").slice(0, 6).join("\\n") : "";
      parent.postMessage({
        type: "ERROR", message: "Uncaught: " + msg + " (line " + line + ":" + col + ")" + stack
      }, "*");
    };

    // ── Host environment (plateforme, base backend) ──
    window.__tentacle_env = ${JSON.stringify(hostEnv)};

    // ── PostMessage bridge ──
    var _pendingRequests = {};
    var _reqId = 0;

    window.__tentacle_bridge = {
      apiRequest: function(method, path, body) {
        return new Promise(function(resolve, reject) {
          var id = ++_reqId;
          _pendingRequests[id] = { resolve: resolve, reject: reject };
          parent.postMessage({
            type: "API_REQUEST", id: id, method: method, path: path, body: body,
          }, "*");
          setTimeout(function() {
            if (_pendingRequests[id]) {
              delete _pendingRequests[id];
              reject(new Error("API request timeout"));
            }
          }, 30000);
        });
      },
      navigate: function(path) {
        parent.postMessage({ type: "NAVIGATE", path: path }, "*");
      },
      toast: function(message, type) {
        parent.postMessage({ type: "TOAST", message: message, toastType: type || "info" }, "*");
      },
      setOverlay: function(open) {
        parent.postMessage({ type: open ? "OVERLAY_OPEN" : "OVERLAY_CLOSE" }, "*");
      },
      // Ouvre une URL dans le navigateur système via le host (la sandbox
      // allow-scripts bloque window.open / target=_blank dans l'iframe).
      openExternal: function(url) {
        parent.postMessage({ type: "OPEN_EXTERNAL", url: url }, "*");
      },
      // Lecture de bandes-annonces par le HOST (TrailerModal core).
      // Indispensable : un embed YouTube imbriqué dans cette iframe sandboxée
      // hérite de la sandbox (pas d'allow-same-origin) → le player YouTube
      // plante (SecurityError caches / writeEmbed). Le host, lui, n'est pas
      // sandboxé.
      openTrailer: function(trailers, index) {
        parent.postMessage({ type: "OPEN_TRAILER", trailers: trailers, index: index || 0 }, "*");
      },
    };

    // ── Fetch interceptor: route backend API calls through postMessage bridge ──
    // Plugins use regular fetch() but from blob: origin they can't reach the backend.
    // We intercept calls to the backend URL and proxy them via the bridge.
    var _origFetch = window.fetch.bind(window);
    var _backendUrl = ${JSON.stringify(backendUrl)} || "";
    window.fetch = function(input, init) {
      var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
      var apiPath = "";
      // Match /api/* relative paths
      if (url.startsWith("/api/")) {
        apiPath = url;
      }
      // Match full backend URL
      else if (_backendUrl && url.startsWith(_backendUrl + "/api/")) {
        apiPath = url.slice(_backendUrl.length);
      }
      // Not a backend API call — pass through to original fetch
      if (!apiPath) return _origFetch(input, init);

      var method = (init && init.method) ? init.method : "GET";
      var body = (init && init.body) ? init.body : undefined;
      var parsedBody = undefined;
      if (body) {
        try { parsedBody = typeof body === "string" ? JSON.parse(body) : body; }
        catch(e) { parsedBody = body; }
      }
      return window.__tentacle_bridge.apiRequest(method, apiPath, parsedBody)
        .then(function(wrapped) {
          var jsonStr = JSON.stringify(wrapped.__res !== undefined ? wrapped.__res : wrapped);
          var status = wrapped.__status || 200;
          return new Response(jsonStr, {
            status: status,
            headers: { "Content-Type": "application/json" },
          });
        });
    };

    window.addEventListener("message", function(e) {
      var data = e.data;
      if (!data || !data.type) return;

      if (data.type === "API_RESPONSE") {
        var pending = _pendingRequests[data.id];
        if (pending) {
          delete _pendingRequests[data.id];
          if (data.error) pending.reject(new Error(data.error));
          else pending.resolve({ __res: data.result, __status: data.status || 200 });
        }
      }

      if (data.type === "INJECT_BUNDLE" && !window.__bundleInjected) {
        window.__bundleInjected = true;
        try {
          var script = document.createElement("script");
          script.textContent = data.code;
          document.head.appendChild(script);
        } catch (err) {
          document.getElementById("plugin-root").innerHTML =
            '<div class="plugin-error">Bundle error: ' + (err.message || err) + '</div>';
        }
      }
    });
  <\/script>

  <!-- Shared deps inlined (sandboxed iframe cannot access parent window) -->
  <script>${safeDepsCode}<\/script>

  <script>
    (async function() {
      try {
        var deps = window.__SHARED_DEPS__;
        if (!deps) throw new Error("shared-deps.js failed to initialize — window.__SHARED_DEPS__ is undefined");

        var React = deps.React;
        var JSXRuntime = deps.JSXRuntime;
        var ReactDOMClient = deps.ReactDOMClient;
        var TQ = deps.TQ;
        var RI = deps.RI;

        // Initialize i18next instance
        var i18n = deps.i18next.createInstance();
        await i18n.use(RI.initReactI18next).init({
          lng: ${JSON.stringify(lang)},
          fallbackLng: "en",
          resources: {},
          interpolation: { escapeValue: false },
        });

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

        var __pluginRegistered = false;
        window.__tentacle = {
          backendUrl: ${JSON.stringify(backendUrl)},
          registerPlugin: async function(plugin) {
            if (__pluginRegistered) return;
            try {
              if (plugin.initialize) await plugin.initialize();

              // Check admin routes first — admin routes always render (they ARE the config UI)
              var isAdminRoute = false;
              var route = plugin.adminRoutes?.find(function(r) { return r.path === pluginPath; });
              if (route) {
                isAdminRoute = true;
              } else {
                route = plugin.routes?.find(function(r) { return r.path === pluginPath; });
              }

              // Only check isConfigured for non-admin routes
              if (!isAdminRoute && plugin.isConfigured) {
                var configured = await plugin.isConfigured();
                if (configured === false) {
                  document.getElementById("plugin-root").innerHTML =
                    '<div class="plugin-error">Plugin not configured</div>';
                  return;
                }
              }
              if (!route) {
                document.getElementById("plugin-root").innerHTML =
                  '<div class="plugin-error">Route not found: ' + pluginPath + '</div>';
                return;
              }

              var root = ReactDOMClient.createRoot(document.getElementById("plugin-root"));
              root.render(
                React.createElement(TQ.QueryClientProvider, { client: queryClient },
                  React.createElement(RI.I18nextProvider, { i18n: i18n },
                    React.createElement(React.Suspense,
                      { fallback: null },
                      React.createElement(route.component)
                    )
                  )
                )
              );

              __pluginRegistered = true;
              parent.postMessage({ type: "READY", pluginId: plugin.id }, "*");
              parent.postMessage({
                type: "PLUGIN_REGISTER",
                pluginId: plugin.id,
                navItems: (plugin.navItems || []).map(function(n) {
                  return { label: n.label, path: n.path, icon: n.icon ? "custom" : undefined };
                }),
                routes: (plugin.routes || []).map(function(r) { return r.path; }),
              }, "*");
            } catch (err) {
              document.getElementById("plugin-root").innerHTML =
                '<div class="plugin-error">' + (err.message || "Plugin error") + '</div>';
            }
          },
          unregisterPlugin: function() {},
        };

        // Signal host that iframe is ready for the bundle (with retry in case of race)
        parent.postMessage({ type: "IFRAME_READY" }, "*");

        // Retry IFRAME_READY if no INJECT_BUNDLE received within 500ms / 2s
        setTimeout(function() {
          if (!window.__bundleInjected) parent.postMessage({ type: "IFRAME_READY" }, "*");
        }, 500);
        setTimeout(function() {
          if (!window.__bundleInjected) parent.postMessage({ type: "IFRAME_READY" }, "*");
        }, 2000);
      } catch (err) {
        document.getElementById("plugin-root").innerHTML =
          '<div class="plugin-error">Failed to load dependencies: ' + (err.message || err) + '</div>';
      }
    })();
  <\/script>
</body>
</html>`;
}
