interface BuildPluginHtmlParams {
  backendUrl: string;
  lang: string;
  pluginPath: string;
  sharedDepsCode: string;
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
}: BuildPluginHtmlParams): string {
  // Escape </script> in shared-deps code to avoid breaking the HTML
  const safeDepsCode = sharedDepsCode.replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        .then(function(result) {
          var jsonStr = JSON.stringify(result);
          return new Response(jsonStr, {
            status: 200,
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
          else pending.resolve(data.result);
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
