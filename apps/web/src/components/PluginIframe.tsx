import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildPluginHtml } from "./buildPluginHtml";
import { backendUrl } from "../main";

interface PluginIframeProps {
  pluginId: string;
  bundleUrl: string;
  pluginPath: string;
}

// Module-level cache for shared-deps.js (fetched once, reused across renders/mounts)
let sharedDepsPromise: Promise<string> | null = null;
function fetchSharedDeps(baseUrl: string): Promise<string> {
  if (!sharedDepsPromise) {
    const url = baseUrl
      ? `${baseUrl}/api/plugins/shared-deps.js`
      : "/api/plugins/shared-deps.js";
    sharedDepsPromise = fetch(url)
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

  const lang = localStorage.getItem("tentacle_language") || "fr";

  // Fetch shared-deps.js
  const [sharedDeps, setSharedDeps] = useState<{
    status: "loading" | "ready" | "error";
    code?: string;
    error?: string;
  }>({ status: "loading" });

  useEffect(() => {
    fetchSharedDeps(backendUrl)
      .then((code) => setSharedDeps({ status: "ready", code }))
      .catch((err) =>
        setSharedDeps({ status: "error", error: (err as Error).message }),
      );
  }, [pluginId]);

  // Build HTML string for iframe srcDoc (avoids blob URL restrictions in sandboxed iframes)
  const htmlContent = useMemo(() => {
    if (sharedDeps.status !== "ready" || !sharedDeps.code) return null;
    return buildPluginHtml({
      backendUrl,
      lang,
      pluginPath,
      sharedDepsCode: sharedDeps.code,
    });
  }, [lang, pluginPath, sharedDeps]);

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
            const res = await fetch(bundleUrl, { credentials: "include" });
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
          try {
            const base = backendUrl || "";
            const headers: Record<string, string> = {};
            if (body) headers["Content-Type"] = "application/json";
            const res = await fetch(`${base}${path}`, {
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

  if (sharedDeps.status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-gray-400">
        Chargement des dépendances…
      </div>
    );
  }

  if (sharedDeps.status === "error") {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-red-400">
        Erreur de chargement des dépendances : {sharedDeps.error}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent!}
      sandbox="allow-scripts"
      title={`plugin-${pluginId}`}
      className="h-full w-full border-0"
      style={{ minHeight: "calc(100vh - 64px)" }}
    />
  );
}
