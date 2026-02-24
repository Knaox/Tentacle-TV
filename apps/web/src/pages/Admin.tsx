import { useState, useEffect, useCallback } from "react";
import { Navbar } from "../components/Navbar";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

interface InviteKey {
  id: number;
  key: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  usages: { username: string; usedAt: string }[];
}

export function Admin() {
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresHours, setExpiresHours] = useState(72);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    const res = await fetch(`${BACKEND_URL}/api/invites`);
    if (res.ok) setInvites(await res.json());
  }, []);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const createInvite = async () => {
    setCreating(true);
    const res = await fetch(`${BACKEND_URL}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUses, expiresInHours: expiresHours }),
    });
    if (res.ok) await fetchInvites();
    setCreating(false);
  };

  const copyLink = (key: string) => {
    const url = `${window.location.origin}/register?invite=${key}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />
      <div className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <h1 className="mb-8 text-3xl font-bold text-white">Administration</h1>

        {/* Create invite */}
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Générer un lien d'invitation</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-white/40">Utilisations max</label>
              <input type="number" min={1} max={100} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-24 rounded-lg bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-tentacle-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/40">Expire dans (heures)</label>
              <input type="number" min={1} max={720} value={expiresHours} onChange={(e) => setExpiresHours(Number(e.target.value))}
                className="w-24 rounded-lg bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-tentacle-accent" />
            </div>
            <button onClick={createInvite} disabled={creating}
              className="rounded-lg bg-tentacle-accent px-5 py-2 font-semibold text-white transition-transform hover:scale-105 disabled:opacity-50">
              {creating ? "..." : "Générer"}
            </button>
          </div>
        </div>

        {/* Invite list */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Invitations existantes</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-white/40">Aucune invitation</p>
          ) : (
            <div className="space-y-3">
              {invites.map((inv) => {
                const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                const full = inv.currentUses >= inv.maxUses;
                const active = !expired && !full;
                return (
                  <div key={inv.id} className={`rounded-lg border p-4 ${active ? "border-white/10" : "border-white/5 opacity-50"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <code className="text-sm font-mono text-tentacle-accent-light">{inv.key}</code>
                        <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                          <span>{inv.currentUses}/{inv.maxUses} utilisé(s)</span>
                          {inv.expiresAt && (
                            <span>{expired ? "Expiré" : `Expire le ${new Date(inv.expiresAt).toLocaleDateString("fr-FR")}`}</span>
                          )}
                          <span>Créé le {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</span>
                        </div>
                        {inv.usages.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {inv.usages.map((u) => (
                              <span key={u.username} className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/50">{u.username}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {active && (
                        <button onClick={() => copyLink(inv.key)}
                          className="flex-shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                          {copiedKey === inv.key ? "Copié !" : "Copier le lien"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
