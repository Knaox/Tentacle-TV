import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { problemFromError, problemDetails, rawFromError } from "@tentacle-tv/shared";
import { backendUrl } from "../../main";
import { PageProblem } from "../problems/PageProblem";

/**
 * Le chargement d'une page d'extension — ses dépendances partagées, puis son
 * bundle — et son échec, DIT. Avant, une dépendance ou un bundle en échec
 * laissait « Chargement du plugin… » tourner pour toujours : la branche
 * d'erreur venait après celle du chargement, et le bundle échouait en
 * silence. Extrait de `PluginIframe` (limite de 300 lignes).
 */

const LOADER_TEXTS = {
  fr: "Chargement du plugin…",
  en: "Loading plugin…",
} as const;

export function PluginLoader({ lang }: { lang: string }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-6 bg-surface-1">
      <div className="relative animate-pulse">
        <img
          src="/tentacle-logo-pirate.svg"
          alt="Tentacle"
          className="h-16 w-16 drop-shadow-[0_0_20px_rgba(var(--brand-rgb), 0.5)]"
        />
        <div className="absolute -inset-3 animate-spin rounded-full border-2 border-transparent border-t-purple-500/60"
          style={{ animationDuration: "1.2s" }}
        />
      </div>
      <p className="text-sm text-gray-400/80">{LOADER_TEXTS[lang === "fr" ? "fr" : "en"]}</p>
    </div>
  );
}

/** Une ressource du serveur, son statut gardé dans l'erreur (le message le dira). */
function fetchText(url: string, label: string): Promise<string> {
  return fetch(url).then((r) => {
    if (!r.ok) throw Object.assign(new Error(`${label} fetch failed: ${r.status}`), { status: r.status });
    return r.text();
  });
}

// Caches de module (une fois par session) ; un échec se retente.
let sharedDepsPromise: Promise<string> | null = null;
function fetchSharedDeps(baseUrl: string): Promise<string> {
  sharedDepsPromise ??= fetchText(`${baseUrl}/api/plugins/shared-deps.js?v=2`, "shared-deps.js")
    .catch((err) => { sharedDepsPromise = null; throw err; });
  return sharedDepsPromise;
}

// Tailwind servi par le backend (ni CORS ni CSP à négocier sur les coquilles).
let tailwindPromise: Promise<string> | null = null;
function fetchTailwind(baseUrl: string): Promise<string> {
  tailwindPromise ??= fetchText(`${baseUrl}/api/plugins/tailwind.js`, "Tailwind")
    .catch((err) => { tailwindPromise = null; throw err; });
  return tailwindPromise;
}

export interface PluginDeps {
  status: "loading" | "ready" | "error";
  sharedDepsCode?: string;
  tailwindCode?: string;
  error?: unknown;
}

/** Les dépendances d'une page d'extension, l'échec du bundle, et « Réessayer ». */
export function usePluginDeps(pluginId: string, onRetry: () => void) {
  const [deps, setDeps] = useState<PluginDeps>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchSharedDeps(backendUrl), fetchTailwind(backendUrl)])
      .then(([sharedDepsCode, tailwindCode]) => alive && setDeps({ status: "ready", sharedDepsCode, tailwindCode }))
      .catch((error: unknown) => alive && setDeps({ status: "error", error }));
    return () => { alive = false; };
  }, [pluginId, attempt]);
  const failBundle = useCallback((error: unknown) => setDeps({ status: "error", error }), []);
  const retry = useCallback(() => {
    onRetry();
    setDeps({ status: "loading" });
    setAttempt((value) => value + 1);
  }, [onRetry]);
  return { deps, failBundle, retry };
}

/** « Cette extension ne s'affiche pas » : pourquoi (serveur muet, extension absente…), Réessayer, Retour. */
export function PluginLoadProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const navigate = useNavigate();
  const model = useMemo(() => {
    const raw = rawFromError(error, "tentacle");
    const base = problemFromError(error, { target: "tentacle", context: "extension", availability: { canGoBack: true } });
    return { ...base, details: problemDetails({ status: raw.status, message: raw.message }) };
  }, [error]);
  return <PageProblem model={model} onAction={(key) => (key === "retry" ? onRetry() : navigate(-1))} />;
}
