import { useState, useEffect, useCallback } from "react";
import { useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus } from "@tentacle/api-client";
import type { SupportTicket } from "@tentacle/api-client";
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

        {/* Support tickets */}
        <AdminTicketSection />

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

const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "bg-green-500/20 text-green-400" },
  in_progress: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  resolved: { label: "Résolu", color: "bg-purple-500/20 text-purple-400" },
  closed: { label: "Fermé", color: "bg-white/10 text-white/40" },
};

function AdminTicketSection() {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data } = useAllTickets(filter || undefined);
  const tickets = data?.results ?? [];

  if (selectedId) {
    return (
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <AdminTicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Tickets de support</h2>

      <div className="mb-4 flex gap-2">
        {[
          { key: "", label: "Tous" },
          { key: "open", label: "Ouverts" },
          { key: "in_progress", label: "En cours" },
          { key: "resolved", label: "Résolus" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-white/40">Aucun ticket</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t: SupportTicket) => {
            const st = TICKET_STATUS[t.status];
            return (
              <div
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-white/5 p-3 transition-colors hover:bg-white/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  <p className="text-xs text-white/40">{t.username} — {new Date(t.updatedAt).toLocaleDateString("fr-FR")}</p>
                  {t.mediaItemName && <p className="mt-0.5 text-xs text-purple-400 truncate">{t.mediaItemName}</p>}
                </div>
                {st && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminTicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket } = useTicketDetail(ticketId);
  const [reply, setReply] = useState("");
  const replyMut = useReplyTicket();
  const statusMut = useUpdateTicketStatus();

  if (!ticket) return <p className="text-white/40">Chargement...</p>;

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    replyMut.mutate({ ticketId, body: reply.trim() }, { onSuccess: () => setReply("") });
  };

  const st = TICKET_STATUS[ticket.status];

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm text-white/50 hover:text-white">← Retour</button>

      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-base font-semibold text-white">{ticket.subject}</h3>
        {st && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>}
      </div>
      {ticket.mediaItemName && (
        <p className="mb-3 text-xs text-purple-400">{ticket.mediaItemName}</p>
      )}

      <div className="mb-4 flex gap-2">
        {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => statusMut.mutate({ ticketId, status: s })}
            disabled={ticket.status === s}
            className={`rounded-lg px-3 py-1 text-xs transition-colors ${
              ticket.status === s ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
            } disabled:opacity-50`}
          >
            {TICKET_STATUS[s].label}
          </button>
        ))}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {ticket.messages?.map((msg) => (
          <div key={msg.id} className={`rounded-lg p-3 ${msg.isAdmin ? "border border-purple-500/20 bg-purple-500/10" : "bg-white/5"}`}>
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className={msg.isAdmin ? "font-medium text-purple-400" : "text-white/70"}>{msg.username}</span>
              {msg.isAdmin && <span className="rounded bg-purple-500/30 px-1 py-0.5 text-[10px] text-purple-300">Admin</span>}
              <span className="text-white/30">{new Date(msg.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <form onSubmit={handleReply} className="mt-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Répondre en tant qu'admin..."
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none"
          />
          <button
            type="submit"
            disabled={replyMut.isPending || !reply.trim()}
            className="mt-2 rounded-lg bg-tentacle-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50"
          >
            {replyMut.isPending ? "Envoi..." : "Répondre"}
          </button>
        </form>
      )}
    </div>
  );
}
