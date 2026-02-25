import { useState, useEffect } from "react";
import { GlassCard } from "@tentacle/ui";

type SetupStep = "db" | "jellyfin" | "admin";

interface SetupProps {
  onComplete: (token: string, user: any) => void;
}

export function ServerSetup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("db");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.state === "setup_db" && (data.dbConnected || data.hasDbUrl)) {
          // DB URL available (env or config file) but tables missing → auto-migrate
          fetch("/api/setup/migrate", { method: "POST" })
            .then((r) => r.json())
            .then((res) => {
              const s = res.state === "setup_admin" ? "admin" : res.state === "setup_jellyfin" ? "jellyfin" : "db";
              setStep(s); setLoading(false);
            })
            .catch(() => { setStep("db"); setLoading(false); });
        } else if (data.dbConnected && data.state !== "setup_db") {
          // DB connected and tables exist → skip to correct step
          const map: Record<string, SetupStep> = { setup_jellyfin: "jellyfin", setup_admin: "admin" };
          setStep(map[data.state] || "db");
          setLoading(false);
        } else {
          // No DB URL at all → show DB step
          setStep("db");
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <StepHeader step={step} />
        {step === "db" && <DbStep onNext={() => setStep("jellyfin")} />}
        {step === "jellyfin" && <JellyfinStep onNext={() => setStep("admin")} />}
        {step === "admin" && <AdminStep onComplete={onComplete} />}
      </div>
    </div>
  );
}

function StepHeader({ step }: { step: SetupStep }) {
  const steps: { key: SetupStep; label: string }[] = [
    { key: "db", label: "Base de données" },
    { key: "jellyfin", label: "Jellyfin" },
    { key: "admin", label: "Administrateur" },
  ];
  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div className="mb-6 text-center">
      <img src="/tentacle-logo-pirate.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
      <h1 className="mb-4 text-2xl font-bold">
        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Configuration de Tentacle
        </span>
      </h1>
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              i < idx ? "bg-green-500 text-white" : i === idx ? "bg-purple-500 text-white" : "bg-white/10 text-white/40"
            }`}>{i < idx ? "\u2713" : i + 1}</div>
            <span className={`text-xs ${i === idx ? "text-white" : "text-white/40"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-white/20" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DbStep({ onNext }: { onNext: () => void }) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3306");
  const [database, setDatabase] = useState("tentacle");
  const [user, setUser] = useState("tentacle");
  const [password, setPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const handleTest = async () => {
    setError(""); setTesting(true); setOk(false);
    try {
      const r1 = await fetch("/api/setup/test-db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port: Number(port), database, user, password }),
      });
      if (!r1.ok) { const d = await r1.json(); throw new Error(d.message); }
      const r2 = await fetch("/api/setup/migrate", { method: "POST" });
      if (!r2.ok) { const d = await r2.json(); throw new Error(d.message); }
      setOk(true);
    } catch (err: any) {
      setError(err.message || "Connexion echouee");
    } finally { setTesting(false); }
  };

  return (
    <GlassCard className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Base de données</h2>
      <p className="mb-4 text-sm text-white/50">Connexion MariaDB / MySQL.</p>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Inp label="Hote" value={host} set={setHost} /></div>
          <Inp label="Port" value={port} set={setPort} />
        </div>
        <Inp label="Nom de la base" value={database} set={setDatabase} />
        <Inp label="Utilisateur" value={user} set={setUser} />
        <Inp label="Mot de passe" value={password} set={setPassword} type="password" />
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {ok && <p className="mt-3 text-sm text-green-400">Connexion reussie, tables creees.</p>}
      <div className="mt-4 flex gap-3">
        <Btn onClick={handleTest} disabled={testing || !password} secondary>
          {testing ? "Test..." : "Tester la connexion"}
        </Btn>
        <Btn onClick={onNext} disabled={!ok} className="ml-auto">Suivant</Btn>
      </div>
    </GlassCard>
  );
}

function JellyfinStep({ onNext }: { onNext: () => void }) {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [saved, setSaved] = useState(false);

  const handleTest = async () => {
    setError(""); setTesting(true); setVersion("");
    try {
      const r = await fetch("/api/setup/test-jellyfin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.replace(/\/$/, ""), apiKey }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setVersion(d.version);
    } catch (err: any) { setError(err.message); } finally { setTesting(false); }
  };

  const handleSave = async () => {
    try {
      const r = await fetch("/api/setup/save-jellyfin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.replace(/\/$/, ""), apiKey }),
      });
      if (!r.ok) throw new Error("Echec");
      setSaved(true);
    } catch (err: any) { setError(err.message); }
  };

  return (
    <GlassCard className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Serveur Jellyfin</h2>
      <p className="mb-4 text-sm text-white/50">Connectez Tentacle a votre serveur media.</p>
      <div className="space-y-3">
        <Inp label="URL du serveur" value={url} set={setUrl} placeholder="http://192.168.1.100:8096" />
        <Inp label="Cle API admin" value={apiKey} set={setApiKey} />
      </div>
      {version && <p className="mt-3 text-sm text-green-400">Jellyfin {version} detecte</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-3">
        <Btn onClick={handleTest} disabled={testing || !url || !apiKey} secondary>
          {testing ? "Test..." : "Tester"}
        </Btn>
        {version && !saved && <Btn onClick={handleSave} secondary>Sauvegarder</Btn>}
        <Btn onClick={onNext} disabled={!saved} className="ml-auto">Suivant</Btn>
      </div>
    </GlassCard>
  );
}

function AdminStep({ onComplete }: { onComplete: (token: string, user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError(""); setCreating(true);
    try {
      const r = await fetch("/api/setup/create-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onComplete(d.token, d.user);
    } catch (err: any) { setError(err.message); } finally { setCreating(false); }
  };

  return (
    <GlassCard className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Compte administrateur</h2>
      <p className="mb-4 text-sm text-white/50">
        Connectez-vous avec un compte administrateur Jellyfin existant.
      </p>
      <div className="space-y-3">
        <Inp label="Nom d'utilisateur Jellyfin" value={username} set={setUsername} />
        <Inp label="Mot de passe Jellyfin" value={password} set={setPassword} type="password" />
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4">
        <Btn onClick={handleCreate} disabled={creating || !username || !password} className="w-full">
          {creating ? "Verification..." : "Verifier et creer"}
        </Btn>
      </div>
    </GlassCard>
  );
}

function Inp({ label, value, set, placeholder, type = "text" }: {
  label: string; value: string; set: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/60">{label}</label>
      <input type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none" />
    </div>
  );
}

function Btn({ children, onClick, disabled, secondary, className = "" }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  secondary?: boolean; className?: string;
}) {
  const base = secondary
    ? "rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
    : "rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 text-sm font-semibold hover:opacity-90";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} transition disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}
