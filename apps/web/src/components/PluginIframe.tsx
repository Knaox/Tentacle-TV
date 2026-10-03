import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildPluginHtml } from "./buildPluginHtml";
import { usePluginMount } from "../desktop/pluginDocument";
import { backendUrl } from "../main";
import { resolveBridgeUrl } from "./pluginIframe/resolveBridgeUrl";
import { setHostChromeVeil } from "./pluginIframe/hostChromeVeil";
import { markPluginNavigation } from "./detail/detailTransition";
import { openExternal } from "../lib/openExternal";
import { TrailerModal } from "./detail/TrailerModal";
import { PluginLoader, PluginLoadProblem, usePluginDeps } from "./pluginIframe/pluginLoad";

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

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("tentacle_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface PluginIframeProps {
  pluginId: string;
  bundleUrl: string;
  pluginPath: string;
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
  // Query de la route hôte, transmise à l'iframe (deep-link du plugin, ex.
  // « ?media=movie:603 » posé par les cartes de recommandation).
  const { search } = useLocation();
  const bundleFetched = useRef(false);
  // Trailers demandés par le plugin — joués dans le TrailerModal du HOST
  // (l'embed YouTube ne fonctionne pas dans l'iframe sandboxée du plugin).
  const [trailerState, setTrailerState] = useState<{ trailers: PluginTrailer[]; index: number } | null>(null);

  const lang = localStorage.getItem("tentacle_language") || "fr";

  // shared-deps.js + Tailwind, puis le bundle : un échec se DIT (pluginLoad.tsx).
  const { deps, failBundle, retry } = usePluginDeps(pluginId, () => { bundleFetched.current = false; });

  // Build HTML for iframe srcDoc
  const htmlContent = useMemo(() => {
    if (deps.status !== "ready" || !deps.sharedDepsCode || !deps.tailwindCode) return null;
    return buildPluginHtml({
      backendUrl,
      lang,
      pluginPath,
      pluginQuery: search,
      sharedDepsCode: deps.sharedDepsCode,
      tailwindCode: deps.tailwindCode,
    });
  }, [lang, pluginPath, search, deps]);

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
            if (!res.ok) throw Object.assign(new Error(`Bundle fetch failed: ${res.status}`), { status: res.status });
            const code = await res.text();
            iframe.contentWindow?.postMessage(
              { type: "INJECT_BUNDLE", code },
              "*",
            );
          } catch (error) {
            failBundle(error);
          }
          break;
        }

        case "API_REQUEST": {
          const { id, method, path, body } = data;
          // Cette requête part avec les identifiants de l'utilisateur (Bearer
          // + cookies) et son chemin vient du greffon. Une CONCATÉNATION n'est
          // pas une résolution : `@pirate/x` accolé à la base donne une URL
          // valide dont l'hôte est `pirate`. Voir `resolveBridgeUrl.ts`.
          const target = resolveBridgeUrl(backendUrl || "", path, window.location.origin);
          if (target === null) {
            iframe.contentWindow?.postMessage(
              { type: "API_RESPONSE", id, error: "chemin refuse" },
              "*",
            );
            break;
          }
          try {
            const headers: Record<string, string> = { ...getAuthHeaders() };
            if (body) headers["Content-Type"] = "application/json";
            const res = await fetch(target, {
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
          if (typeof data.path === "string") {
            // Le cadre du greffon va être détruit : son `OVERLAY_CLOSE` ne
            // partira pas, et la fiche d'arrivée n'a aucune origine à jouer.
            // Les deux se règlent ICI, avant que la route ne change.
            setHostChromeVeil(false);
            markPluginNavigation();
            navigate(data.path);
          }
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


        case "OVERLAY_OPEN":
          setHostChromeVeil(true);
          break;

        case "OVERLAY_CLOSE":
          setHostChromeVeil(false);
          break;

        case "READY":
        case "PLUGIN_REGISTER":
          break;
      }
    },
    [bundleUrl, navigate, pluginId, failBundle],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Reset fetch state when bundle URL or plugin path changes (same plugin,
  // different page). La query en fait partie : elle recompose le srcDoc
  // (deep-link), donc l'iframe repart de zéro et le bundle doit être réinjecté.
  useEffect(() => {
    bundleFetched.current = false;
  }, [bundleUrl, pluginPath, search]);

  /*
   * Le voile du chrome ne survit pas au cadre qui l'a demandé.
   *
   * Le greffon lève le sien au démontage de sa surface modale — sauf quand ce
   * démontage est la destruction du cadre lui-même : sortie par la barre
   * latérale, retour navigateur, changement de page de greffon. Le voile est
   * posé sur le DOM de l'hôte, il lui survivrait sans ceci.
   */
  useEffect(() => () => setHostChromeVeil(false), []);

  /*
   * Le clavier appartient à la page affichée.
   *
   * Sans ce focus, tant que l'utilisateur n'a pas cliqué dans le cadre, les
   * frappes vont à Tentacle TV : ⌘K ouvrait la recherche globale alors qu'on
   * se trouve sur une page de plugin qui a la sienne. Générique, valable pour
   * tout plugin.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => iframeRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [pluginPath]);

  // Où monter le document : en ligne partout, sur une origine dédiée sous
  // Electron — dont la politique de sécurité refuse les scripts inline de la
  // page. Voir `desktop/pluginDocument.ts`.
  const mount = usePluginMount(pluginId, htmlContent);

  // L'échec D'ABORD : sans dépendances, `mount` reste nul pour toujours.
  if (deps.status === "error") return <PluginLoadProblem error={deps.error} onRetry={retry} />;
  if (deps.status === "loading" || mount === null) return <PluginLoader lang={lang} />;

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
