// Scripts runtime de l'iframe plugin : shims, bridge postMessage vers le host,
// interception fetch, puis bootstrap React (shared deps + registerPlugin).
// Aucun token d'auth ne transite — les requêtes API passent par le bridge.

/** Environnement hôte exposé aux plugins (iframe sandboxée = aucun accès à la
 * window parente ni aux marqueurs du shell). */
export interface PluginHostEnv {
  /** Shell Tauri précisément. Conservé tel quel : les greffons déjà publiés
   *  s'en servent, en changer le sens les casserait silencieusement. */
  tauri: boolean;
  /** Application de bureau, quel que soit le shell. À préférer à `tauri` pour
   *  toute question du genre « ai-je une origine applicative sans referrer
   *  HTTP, un catalogue local, des commandes natives ». */
  desktop: boolean;
  mac: boolean;
  prod: boolean;
  backendUrl: string;
}

/**
 * Script (sans balises) : shim localStorage, error handler, bridge postMessage
 * (`__tentacle_bridge`), interception de fetch vers le backend, et réception
 * du bundle injecté par le host.
 */
export function buildPluginBridgeScript(params: { backendUrl: string; hostEnv: PluginHostEnv }): string {
  const { backendUrl, hostEnv } = params;
  return `
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
  `;
}

/**
 * Script (sans balises) : initialisation des shared deps (React, TanStack
 * Query, i18next), exposition de `window.TentacleShared` / `window.__tentacle`
 * et handshake IFRAME_READY → INJECT_BUNDLE avec le host.
 */
export function buildPluginBootstrapScript(params: { backendUrl: string; lang: string; pluginPath: string }): string {
  const { backendUrl, lang, pluginPath } = params;
  return `
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
  `;
}
