import { useState, useEffect } from "react";
import { getSeerBackendUrl } from "../../api/endpoints";

interface SeerConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  autoApprove: boolean;
  userLimit: number;
}

export function SeerConfigPage() {
  const [config, setConfig] = useState<SeerConfig>({
    url: "",
    apiKey: "",
    enabled: false,
    autoApprove: false,
    userLimit: 0,
  });
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const backendBase = getSeerBackendUrl();
  const token = localStorage.getItem("tentacle_token") ?? "";

  useEffect(() => {
    fetch(`${backendBase}/api/plugins/seer/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          url: data.url ?? "",
          apiKey: data.apiKey ?? "",
          enabled: data.enabled ?? false,
          autoApprove: data.autoApprove ?? false,
          userLimit: data.userLimit ?? 0,
        });
        setStatus(data.url ? "connected" : "idle");
      })
      .catch(() => setStatus("idle"));
  }, [backendBase, token]);

  const testConnection = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const res = await fetch(`${backendBase}/api/admin/test-seerr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: config.url, apiKey: config.apiKey }),
      });
      if (res.ok) {
        setStatus("connected");
        setMessage("Connexion réussie");
      } else {
        setStatus("error");
        setMessage("Échec de la connexion");
      }
    } catch {
      setStatus("error");
      setMessage("Impossible de joindre le serveur");
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${backendBase}/api/plugins/seer/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (res.ok) setMessage("Configuration sauvegardée");
      else setMessage("Erreur lors de la sauvegarde");
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = status === "connected"
    ? "bg-emerald-500"
    : status === "error"
      ? "bg-red-500"
      : status === "testing"
        ? "bg-yellow-500 animate-pulse"
        : "bg-gray-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Configuration Seer</h2>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-xs text-white/50">
            {status === "connected" ? "Connecté" : status === "error" ? "Erreur" : status === "testing" ? "Test..." : "Non configuré"}
          </span>
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">URL Jellyseerr</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={config.url}
            onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
            placeholder="https://jellyseerr.example.com"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500"
          />
          <button
            onClick={testConnection}
            disabled={!config.url || status === "testing"}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/15 disabled:opacity-40"
          >
            Tester
          </button>
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Clé API</label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
          placeholder="Clé API Jellyseerr"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <ToggleRow
          label="Activer Seer"
          description="Active le plugin de demandes de médias"
          checked={config.enabled}
          onChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
        />
        <ToggleRow
          label="Auto-approbation"
          description="Approuver automatiquement les demandes"
          checked={config.autoApprove}
          onChange={(v) => setConfig((c) => ({ ...c, autoApprove: v }))}
        />
      </div>

      {/* User limit */}
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">
          Limite par utilisateur (0 = illimite)
        </label>
        <input
          type="number"
          min={0}
          value={config.userLimit}
          onChange={(e) => setConfig((c) => ({ ...c, userLimit: parseInt(e.target.value) || 0 }))}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {message && <span className="text-sm text-white/50">{message}</span>}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-purple-600" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
