import { useState } from "react";
import { GlassCard } from "@tentacle/ui";

interface ServerSetupProps {
  onComplete: (jellyfinUrl: string, backendUrl: string) => void;
}

export function ServerSetup({ onComplete }: ServerSetupProps) {
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTesting(true);

    const cleanJellyfin = jellyfinUrl.replace(/\/$/, "");
    const cleanBackend = backendUrl.replace(/\/$/, "") || cleanJellyfin;

    try {
      // Test Jellyfin connection
      const res = await fetch(`${cleanJellyfin}/System/Info/Public`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("Impossible de contacter le serveur");
      const info = await res.json();
      if (!info.Id) throw new Error("Réponse invalide du serveur");
    } catch {
      setError("Impossible de se connecter au serveur Jellyfin. Vérifiez l'URL.");
      setTesting(false);
      return;
    }

    setTesting(false);
    onComplete(cleanJellyfin, cleanBackend);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-2 flex justify-center">
          <img src="/tentacle-logo-pirate.svg" alt="" className="h-16 w-16" />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Configuration
          </span>
        </h1>
        <p className="mb-8 text-center text-sm text-white/50">
          Connectez Tentacle à votre serveur
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              URL du serveur Jellyfin
            </label>
            <input
              type="url" placeholder="https://jellyfin.example.com" value={jellyfinUrl}
              onChange={(e) => setJellyfinUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              URL du backend Tentacle <span className="text-white/30">(optionnel)</span>
            </label>
            <input
              type="url" placeholder="Même que Jellyfin si vide" value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-white/30">
              Laissez vide si le backend est sur le même serveur
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={testing}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {testing ? "Test de connexion..." : "Se connecter"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
