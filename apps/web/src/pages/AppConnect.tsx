import { useState } from "react";
import { GlassCard } from "@tentacle/ui";

interface AppConnectProps {
  onConnected: () => void;
}

/**
 * Simple "connect to server" screen for desktop/app mode.
 * Only asks for the Tentacle Web URL — no DB/Jellyfin/Admin config.
 */
export function AppConnect({ onConnected }: AppConnectProps) {
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    setTesting(true);
    try {
      let normalized = url.trim().replace(/\/+$/, "");
      // Add protocol if missing (prefer https)
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = "https://" + normalized;
      }
      // Strip redundant default ports
      normalized = normalized.replace(/^(https:\/\/[^/:]+):443\b/, "$1");
      normalized = normalized.replace(/^(http:\/\/[^/:]+):80\b/, "$1");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${normalized}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Serveur introuvable");
      const data = await res.json();
      if (data.status !== "ok") throw new Error("Reponse invalide du serveur");
      localStorage.setItem("tentacle_server_url", normalized);
      onConnected();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Delai de connexion depasse. Le serveur ne repond pas.");
      } else {
        setError("Serveur introuvable. Verifiez l'URL et reessayez.");
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/tentacle-logo-pirate.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="mb-2 text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Bienvenue sur Tentacle
            </span>
          </h1>
          <p className="text-sm text-white/50">
            Entrez l'adresse de votre serveur Tentacle pour commencer.
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-white/60">
              Adresse du serveur
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tentacle.example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && url && handleConnect()}
            />
            <p className="mt-1.5 text-xs text-white/30">
              Ex : https://tentacle.example.com ou http://192.168.1.100:80
            </p>
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={testing || !url}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          >
            {testing ? "Connexion..." : "Se connecter"}
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
