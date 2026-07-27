import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildPluginHtml } from "./buildPluginHtml";
import { usePluginMount } from "../desktop/pluginDocument";
import { backendUrl } from "../main";
import { resolveBridgeUrl } from "./pluginIframe/resolveBridgeUrl";
import { openExternal } from "../lib/openExternal";
import { TrailerModal } from "./detail/TrailerModal";

interface PluginTrailer {
  Url: string;
  Name?: string;
}

/** Valide la liste de trailers reçue du plugin (postMessage non typé). */
function sanitizeTrailers(input: unknown): PluginTrailer[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is { Url: string; Name?: unknown } =>
      !!t && typeof (t as { Url?: unknown }).Url === "string"
      && /^https?:\/\//i.test((t as { Url: string }).Url))
    .map((t) => ({ Url: t.Url, Name: typeof t.Name === "string" ? t.Name : undefined }))
    .slice(0, 50);
}

const LOADER_TEXTS = {
  fr: { loading: "Chargement du plugin…", error: "Erreur de chargement" },
  en: { loading: "Loading plugin…", error: "Loading error" },
} as const;

function PluginLoader({ lang, error }: { lang: string; error?: string }) {
  const t = LOADER_TEXTS[lang === "fr" ? "fr" : "en"];
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-6 bg-surface-1">
      <div className={`relative ${error ? "" : "animate-pulse"}`}>
        <img
          src="/tentacle-logo-pirate.svg"
          alt="Tentacle"
          className="h-16 w-16 drop-shadow-[0_0_20px_rgba(var(--brand-rgb), 0.5)]"
        />
        {!error && (
          <div className="absolute -inset-3 animate-spin rounded-full border-2 border-transparent border-t-purple-500/60"
            style={{ animationDuration: "1.2s" }}
          />
        )}
      </div>
      {error ? (
        <div className="text-center">
          <p className="text-sm font-medium text-status-error-fg">{t.error}</p>
          <p className="mt-1 max-w-xs text-xs text-status-error-fg">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400/80">{t.loading}</p>
      )}
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("tentacle_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface PluginIframeProps {
  pluginId: string;
  bundleUrl: string;
  pluginPath: string;
}

// Module-level cache for shared-deps.js (fetched once, reused across renders/mounts)
let sharedDepsPromise: Promise<string> | null = null;
function fetchSharedDeps(baseUrl: string): Promise<string> {
  if (!sharedDepsPromise) {
    sharedDepsPromise = fetch(`${baseUrl}/api/plugins/shared-deps.js?v=2`)
      .then((r) => {
        if (!r.ok) throw new Error(`shared-deps.js fetch failed: ${r.status}`);
        return r.text();
      })
      .catch((err) => {
        sharedDepsPromise = null; // allow retry on failure
        throw err;
      });
  }
  return sharedDepsPromise;
}

// Module-level cache for Tailwind runtime (served from backend to avoid CORS/CSP issues in Tauri)
let tailwindPromise: Promise<string> | null = null;
function fetchTailwind(baseUrl: string): Promise<string> {
  if (!tailwindPromise) {
    tailwindPromise = fetch(`${baseUrl}/api/plugins/tailwind.js`)
      .then((r) => {
        if (!r.ok) throw new Error(`Tailwind fetch failed: ${r.status}`);
        return r.text();
      })
      .catch((err) => {
        tailwindPromise = null;
        throw err;
      });
  }
  return tailwindPromise;
}

/**
 * Renders a plugin inside a sandboxed iframe (allow-scripts only).
 * The plugin has NO access to the parent's DOM, localStorage, or cookies.
 * API requests are proxied through postMessage → host fetch with credentials.
 */
export function PluginIframe({
  pluginId,
  bundleUrl,
  pluginPath,
}: PluginIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const bundleFetched = useRef(false);
  // Trailers demandés par le plugin — joués dans le TrailerModal du HOST
  // (l'embed YouTube ne fonctionne pas dans l'iframe sandboxée du plugin).
  const [trailerState, setTrailerState] = useState<{ trailers: PluginTrailer[]; index: number } | null>(null);

  const lang = localStorage.getItem("tentacle_language") || "fr";

  // Fetch shared-deps.js + Tailwind CDN
  const [deps, setDeps] = useState<{
    status: "loading" | "ready" | "error";
    sharedDepsCode?: string;
    tailwindCode?: string;
    error?: string;
  }>({ status: "loading" });

  useEffect(() => {
    Promise.all([fetchSharedDeps(backendUrl), fetchTailwind(backendUrl)])
      .then(([sharedDepsCode, tailwindCode]) =>
        setDeps({ status: "ready", sharedDepsCode, tailwindCode }),
      )
      .catch((err) =>
        setDeps({ status: "error", error: (err as Error).message }),
      );
  }, [pluginId]);

  // Build HTML for iframe srcDoc
  const htmlContent = useMemo(() => {
    if (deps.status !== "ready" || !deps.sharedDepsCode || !deps.tailwindCode) return null;
    return buildPluginHtml({
      backendUrl,
      lang,
      pluginPath,
      sharedDepsCode: deps.sharedDepsCode,
      tailwindCode: deps.tailwindCode,
    });
  }, [lang, pluginPath, deps]);

  // Handle postMessage from iframe
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow)
        return;

      const { data } = event;
      if (!data?.type) return;

      switch (data.type) {
        case "IFRAME_READY": {
          if (bundleFetched.current) return;
          bundleFetched.current = true;
          try {
            const res = await fetch(bundleUrl, {
              credentials: "include",
              headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
            const code = await res.text();
            iframe.contentWindow?.postMessage(
              { type: "INJECT_BUNDLE", code },
              "*",
            );
          } catch {
            // Bundle fetch failed — iframe will show its own error via retry timeout
          }
          break;
        }

        case "API_REQUEST": {
          const { id, method, path, body } = data;
          // Cette requête part avec les identifiants de l'utilisateur (Bearer
          // + cookies) et son chemin vient du greffon. Une CONCATÉNATION n'est
          // pas une résolution : `@pirate/x` accolé à la base donne une URL
          // valide dont l'hôte est `pirate`. Voir `resolveBridgeUrl.ts`.
          const cible = resolveBridgeUrl(backendUrl || "", path, window.location.origin);
          if (cible === null) {
            iframe.contentWindow?.postMessage(
              { type: "API_RESPONSE", id, error: "chemin refuse" },
              "*",
            );
            break;
          }
          try {
            const headers: Record<string, string> = { ...getAuthHeaders() };
            if (body) headers["Content-Type"] = "application/json";
            const res = await fetch(cible, {
              method: method || "GET",
              headers,
              credentials: "include",
              ...(body
                ? {
                    body:
                      typeof body === "string" ? body : JSON.stringify(body),
                  }
                : {}),
            });
            const text = await res.text();
            let result;
            try {
              result = JSON.parse(text);
            } catch {
              result = text;
            }
            iframe.contentWindow?.postMessage(
              { type: "API_RESPONSE", id, result, status: res.status },
              "*",
            );
          } catch (err) {
            iframe.contentWindow?.postMessage(
              { type: "API_RESPONSE", id, error: (err as Error).message },
              "*",
            );
          }
          break;
        }

        case "NAVIGATE":
          if (typeof data.path === "string") navigate(data.path);
          break;

        // Lien externe demandé par le plugin (sandbox sans allow-popups) —
        // ouvert via le host : plugin opener sous Tauri, window.open sur web.
        case "OPEN_EXTERNAL":
          if (typeof data.url === "string" && /^https?:\/\//i.test(data.url)) {
            void openExternal(data.url);
          }
          break;

        // Bande-annonce demandée par le plugin → TrailerModal du host.
        case "OPEN_TRAILER": {
          const trailers = sanitizeTrailers(data.trailers);
          if (trailers.length > 0) {
            const index = typeof data.index === "number"
              ? Math.min(Math.max(0, data.index), trailers.length - 1) : 0;
            setTrailerState({ trailers, index });
          }
          break;
        }


        case "OVERLAY_OPEN": {
          document.querySelectorAll<HTMLElement>("[data-host-chrome]").forEach((el) => {
            el.style.filter = "blur(4px) brightness(0.5)";
            el.style.pointerEvents = "none";
            el.style.transition = "filter 300ms ease";
          });
          break;
        }

        case "OVERLAY_CLOSE": {
          document.querySelectorAll<HTMLElement>("[data-host-chrome]").forEach((el) => {
            el.style.filter = "";
            el.style.pointerEvents = "";
          });
          break;
        }

        case "READY":
        case "PLUGIN_REGISTER":
          break;
      }
    },
    [bundleUrl, navigate, pluginId],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Reset fetch state when bundle URL or plugin path changes (same plugin, different page)
  useEffect(() => {
    bundleFetched.current = false;
  }, [bundleUrl, pluginPath]);

  // Où monter le document : en ligne partout, sur une origine dédiée sous
  // Electron — dont la politique de sécurité refuse les scripts inline de la
  // page. Voir `desktop/pluginDocument.ts`.
  const mount = usePluginMount(pluginId, htmlContent);

  if (deps.status === "loading" || mount === null) {
    return <PluginLoader lang={lang} />;
  }

  if (deps.status === "error") {
    return (
      <PluginLoader lang={lang} error={deps.error} />
    );
  }

  return (
    <>
      <iframe
        ref={iframeRef}
        {...mount}
        sandbox="allow-scripts"
        title={`plugin-${pluginId}`}
        className="h-full w-full border-0"
        style={{ minHeight: "calc(100vh - 64px)" }}
      />
      {trailerState && (
        <TrailerModal
          open
          onClose={() => setTrailerState(null)}
          trailers={trailerState.trailers}
          initialIndex={trailerState.index}
        />
      )}
    </>
  );
}
