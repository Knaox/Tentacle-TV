import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildPluginHtml } from "./buildPluginHtml";
import { usePluginMount } from "../desktop/pluginDocument";
import { backendUrl } from "../main";
import { answerPluginApiRequest, getAuthHeaders } from "./pluginIframe/pluginApiRelay";
import { setHostChromeVeil } from "./pluginIframe/hostChromeVeil";
import { useNavigationWriteWatcher } from "./pluginIframe/pluginNavigationWrite";
import { markPluginNavigation } from "./detail/detailTransition";
import { openExternal } from "../lib/openExternal";
import { TrailerModal } from "./detail/TrailerModal";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import { PLUGIN_IFRAME_SANDBOX } from "@tentacle-tv/plugins-api";
import { TRAILER_PLAYER_AVAILABLE, TrailerPlayer } from "./trailerPlayer";
import {
  OPEN_TRAILER_CATALOG_MESSAGE, loadPluginTrailerQueue, parsePluginTrailerCatalogQuery, type PluginTrailerQueue,
} from "./pluginIframe/pluginTrailerCatalog";
import { sanitizeTrailers, type PluginTrailer } from "./pluginIframe/pluginTrailerList";
import { MEDIA_REQUEST_MESSAGE, answerPluginMediaRequest, parsePluginMediaRequest } from "./pluginIframe/pluginMediaBridge";
import { PluginLoader, PluginLoadProblem, usePluginDeps } from "./pluginIframe/pluginLoad";
import { parseSetQuery, SET_QUERY_MESSAGE } from "./pluginIframe/pluginQuerySync";
import { usePluginQuerySync } from "./pluginIframe/usePluginQuerySync";
import {
  TRAILER_PREVIEW_MUTED_MESSAGE, TRAILER_PREVIEW_VOLUME_MESSAGE, applyPluginTrailerPreviewMuted, applyPluginTrailerPreviewVolume,
  pluginTrailerPreviewEnv,
  trailerPreviewEnvMessage, watchPluginTrailerPreviewEnv,
} from "./pluginIframe/pluginTrailerPreview";


interface PluginIframeProps {
  pluginId: string;
  bundleUrl: string;
  pluginPath: string;
}

/**
 * Renders a plugin inside a sandboxed iframe (allow-scripts only — aucun formulaire natif : `PLUGIN_IFRAME_SANDBOX`).
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
  // « ?media=movie:603 » posé par les cartes de recommandation). Une extension qui tient sa
  // query (`setQuery`) la reçoit redite, sans document refait (pluginQuerySync.ts).
  const postToFrame = useCallback((message: { type: string; query: string }) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);
  const { documentQuery: search, setQuery } = usePluginQuerySync(pluginPath, postToFrame);
  const bundleFetched = useRef(false);
  // Trailers demandés par le plugin — joués dans le TrailerModal du HOST
  // (l'embed YouTube ne fonctionne pas dans l'iframe sandboxée du plugin).
  const [trailerState, setTrailerState] = useState<{ trailers: PluginTrailer[]; index: number } | null>(null);
  // Le lecteur complet sur le catalogue d'un titre (`openTrailerFor`).
  const [catalogPlayer, setCatalogPlayer] = useState<PluginTrailerQueue | null>(null);
  // Décidé UNE fois, la configuration du serveur connue : le document de l'iframe en dépend,
  // et le refaire au passage de « inconnu » à « oui » rechargeait l'extension.
  const server = useServerCapabilities();
  const trailerCatalog = server.capabilities.has("trailers.catalog") && TRAILER_PLAYER_AVAILABLE;

  const lang = localStorage.getItem("tentacle_language") || "fr";
  // L'extension règle sa navigation depuis sa page : la barre suit aussitôt.
  const onApiAnswered = useNavigationWriteWatcher(pluginId);

  // shared-deps.js + Tailwind, puis le bundle : un échec se DIT (pluginLoad.tsx).
  const { deps, failBundle, retry } = usePluginDeps(pluginId, () => { bundleFetched.current = false; });

  // Build HTML for iframe srcDoc
  const htmlContent = useMemo(() => {
    if (deps.status !== "ready" || !deps.sharedDepsCode || !deps.tailwindCode || !server.settled) return null;
    return buildPluginHtml({
      backendUrl,
      lang,
      pluginPath,
      pluginQuery: search,
      sharedDepsCode: deps.sharedDepsCode,
      tailwindCode: deps.tailwindCode,
      trailerCatalog,
    });
  }, [lang, pluginPath, search, deps, trailerCatalog, server.settled]);

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
          // L'état des aperçus a pu changer depuis la fabrication du document.
          iframe.contentWindow.postMessage(trailerPreviewEnvMessage(pluginTrailerPreviewEnv()), "*");
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

        case "API_REQUEST":
          void answerPluginApiRequest(data, backendUrl || "", (message) => {
            iframe.contentWindow?.postMessage(message, "*");
            onApiAnswered(data, message);
          });
          break;

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

        case SET_QUERY_MESSAGE: {
          const query = parseSetQuery(data);
          if (query !== null) setQuery(query);
          break;
        }

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

        // Le lecteur complet de l'hôte, sur le catalogue du serveur pour ce titre.
        case OPEN_TRAILER_CATALOG_MESSAGE: {
          const query = parsePluginTrailerCatalogQuery(data);
          if (query && trailerCatalog) void loadPluginTrailerQueue(query, lang).then((loaded) => loaded && setCatalogPlayer(loaded));
          break;
        }

        // Les octets du relais (aperçus) : le cadre ne joint plus un serveur local.
        case MEDIA_REQUEST_MESSAGE: {
          const request = parsePluginMediaRequest(data);
          if (request) void answerPluginMediaRequest(request, backendUrl || "", (message, transfer) => iframe.contentWindow?.postMessage(message, "*", transfer ?? []));
          break;
        }

        case TRAILER_PREVIEW_MUTED_MESSAGE:
          applyPluginTrailerPreviewMuted(data);
          break;

        case TRAILER_PREVIEW_VOLUME_MESSAGE:
          applyPluginTrailerPreviewVolume(data);
          break;

        case "OVERLAY_OPEN":
          setHostChromeVeil(true);
          break;

        case "OVERLAY_CLOSE":
          setHostChromeVeil(false);
          break;

        // L'extension tourne : l'état des aperçus lui est redit. Celui du document et de
        // IFRAME_READY a pu changer sans qu'un relais n'arrive (page devenue visible pendant
        // le chargement) — l'extension restait alors sur « aperçus coupés », sans retour.
        case "READY":
          iframe.contentWindow.postMessage(trailerPreviewEnvMessage(pluginTrailerPreviewEnv()), "*");
          break;
        case "PLUGIN_REGISTER":
          break;
      }
    },
    [bundleUrl, navigate, pluginId, failBundle, trailerCatalog, lang, onApiAnswered, setQuery],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Les aperçus de bande-annonce de l'extension suivent EN DIRECT ceux du cœur.
  useEffect(() => watchPluginTrailerPreviewEnv((env) => {
    iframeRef.current?.contentWindow?.postMessage(trailerPreviewEnvMessage(env), "*");
  }), []);

  // Un document NEUF (autre page, deep-link, langue…) repart de zéro : le bundle
  // doit y être réinjecté. Suivre le document lui-même, pas la liste de ce qui
  // le compose — un ingrédient oublié laissait l'extension vide.
  useEffect(() => {
    bundleFetched.current = false;
  }, [bundleUrl, htmlContent]);

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
        sandbox={PLUGIN_IFRAME_SANDBOX}
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
      {catalogPlayer && (
        <TrailerPlayer
          queue={catalogPlayer.queue}
          startIndex={catalogPlayer.start}
          language={catalogPlayer.language}
          onClose={() => setCatalogPlayer(null)}
        />
      )}
    </>
  );
}
