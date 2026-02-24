import { useState } from "react";
import {
  useCreateTicket,
  useMyTickets,
  useTicketDetail,
  useReplyTicket,
} from "@tentacle/api-client";
import type { SupportTicket } from "@tentacle/api-client";

const CATEGORIES = [
  { value: "general", label: "Général" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Suggestion" },
  { value: "account", label: "Compte" },
] as const;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "bg-green-500/20 text-green-400" },
  in_progress: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  resolved: { label: "Résolu", color: "bg-purple-500/20 text-purple-400" },
  closed: { label: "Fermé", color: "bg-white/10 text-white/40" },
};

export function SupportPanel() {
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openTicket = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  return (
    <div className="px-12">
      {view === "list" && (
        <TicketList
          onNew={() => setView("new")}
          onOpen={openTicket}
        />
      )}
      {view === "new" && (
        <NewTicketForm
          onBack={() => setView("list")}
          onCreated={(id) => openTicket(id)}
        />
      )}
      {view === "detail" && selectedId && (
        <TicketDetail
          ticketId={selectedId}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

function TicketList({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useMyTickets(filter || undefined);
  const tickets = data?.results ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Mes tickets</h2>
        <button
          onClick={onNew}
          className="rounded-lg bg-tentacle-accent px-4 py-2 text-sm font-semibold text-white hover:bg-tentacle-accent/80"
        >
          Nouveau ticket
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {[
          { key: "", label: "Tous" },
          { key: "open", label: "Ouverts" },
          { key: "in_progress", label: "En cours" },
          { key: "resolved", label: "Résolus" },
          { key: "closed", label: "Fermés" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}

      {!isLoading && tickets.length === 0 && (
        <p className="py-20 text-center text-white/40">Aucun ticket</p>
      )}

      {!isLoading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onClick={() => onOpen(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: SupportTicket; onClick: () => void }) {
  const status = STATUS_LABELS[ticket.status];
  const date = new Date(ticket.updatedAt).toLocaleDateString("fr-FR");
  const catLabel = CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category;

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-xl bg-white/5 px-5 py-4 transition-colors hover:bg-white/10"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
        <p className="mt-0.5 text-xs text-white/40">
          {catLabel} — {date}
          {ticket._count && (
            <span className="ml-2">{ticket._count.messages} message{ticket._count.messages !== 1 ? "s" : ""}</span>
          )}
        </p>
      </div>
      {status && (
        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      )}
    </div>
  );
}

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"general" | "bug" | "feature" | "account">("general");
  const [body, setBody] = useState("");
  const createMut = useCreateTicket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    createMut.mutate(
      { subject: subject.trim(), category, body: body.trim() },
      { onSuccess: (t) => onCreated(t.id) }
    );
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white">
        ← Retour aux tickets
      </button>
      <h2 className="mb-6 text-lg font-semibold text-white">Nouveau ticket</h2>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-xs text-white/50">Sujet</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Décrivez brièvement votre problème..."
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50"
            maxLength={300}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">Catégorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Donnez le plus de détails possible..."
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
            maxLength={5000}
          />
        </div>

        <button
          type="submit"
          disabled={createMut.isPending || !subject.trim() || !body.trim()}
          className="rounded-lg bg-tentacle-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50"
        >
          {createMut.isPending ? "Envoi..." : "Créer le ticket"}
        </button>
      </form>
    </div>
  );
}

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const [reply, setReply] = useState("");
  const replyMut = useReplyTicket();

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    replyMut.mutate(
      { ticketId, body: reply.trim() },
      { onSuccess: () => setReply("") }
    );
  };

  if (isLoading || !ticket) return <Spinner />;

  const status = STATUS_LABELS[ticket.status];
  const isClosed = ticket.status === "closed";

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white">
        ← Retour aux tickets
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{ticket.subject}</h2>
          {status && (
            <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-white/40">
          {CATEGORIES.find((c) => c.value === ticket.category)?.label} —{" "}
          {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
        </p>
      </div>

      {/* Messages */}
      <div className="max-w-3xl space-y-3">
        {ticket.messages?.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 ${
              msg.isAdmin
                ? "border border-purple-500/20 bg-purple-500/10"
                : "bg-white/5"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className={`font-medium ${msg.isAdmin ? "text-purple-400" : "text-white/70"}`}>
                {msg.username}
              </span>
              {msg.isAdmin && (
                <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-[10px] text-purple-300">Admin</span>
              )}
              <span className="text-white/30">
                {new Date(msg.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      {!isClosed && (
        <form onSubmit={handleReply} className="mt-6 max-w-3xl">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Répondre..."
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
            maxLength={5000}
          />
          <button
            type="submit"
            disabled={replyMut.isPending || !reply.trim()}
            className="mt-2 rounded-lg bg-tentacle-accent px-5 py-2 text-sm font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50"
          >
            {replyMut.isPending ? "Envoi..." : "Répondre"}
          </button>
        </form>
      )}

      {isClosed && (
        <p className="mt-6 text-sm text-white/40">Ce ticket est fermé.</p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}
