import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus } from "@tentacle-tv/api-client";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { cls } from "./adminUtils";

const TICKET_STYLES: Record<string, { c: string }> = {
  open: { c: "bg-green-500/20 text-green-400" },
  in_progress: { c: "bg-blue-500/20 text-blue-400" },
  resolved: { c: "bg-purple-500/20 text-purple-400" },
  closed: { c: "bg-white/10 text-white/40" },
};

function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation("admin");
  const labels: Record<string, string> = {
    open: t("admin:ticketOpen"), in_progress: t("admin:ticketInProgress"),
    resolved: t("admin:ticketResolved"), closed: t("admin:ticketClosed"),
  };
  const { data: ticket } = useTicketDetail(id);
  const [reply, setReply] = useState("");
  const rMut = useReplyTicket();
  const sMut = useUpdateTicketStatus();
  if (!ticket) return <p className="text-white/40">{t("common:loading")}</p>;
  const handleReply = (e: React.FormEvent) => { e.preventDefault(); if (!reply.trim()) return; rMut.mutate({ ticketId: id, body: reply.trim() }, { onSuccess: () => setReply("") }); };
  const st = TICKET_STYLES[ticket.status];
  return (<div>
    <button onClick={onBack} className="mb-3 text-sm text-white/50 hover:text-white">&larr; {t("common:back")}</button>
    <div className="mb-4 flex items-center gap-3"><h3 className="text-base font-semibold text-white">{ticket.subject}</h3>
      {st && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${st.c}`}>{labels[ticket.status]}</span>}</div>
    {ticket.mediaItemName && <p className="mb-3 text-xs text-purple-400">{ticket.mediaItemName}</p>}
    <div className="mb-4 flex gap-2">{(["open","in_progress","resolved","closed"] as const).map(s =>
      <button key={s} onClick={() => sMut.mutate({ ticketId: id, status: s })} disabled={ticket.status === s}
        className={`rounded-lg px-3 py-1 text-xs ${ticket.status === s ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"} disabled:opacity-50`}>{labels[s]}</button>)}</div>
    <div className="max-h-80 space-y-2 overflow-y-auto">{ticket.messages?.map(msg => (
      <div key={msg.id} className={`rounded-lg p-3 ${msg.isAdmin ? "border border-purple-500/20 bg-purple-500/10" : "bg-white/5"}`}>
        <div className="mb-1 flex items-center gap-2 text-xs"><span className={msg.isAdmin ? "font-medium text-purple-400" : "text-white/70"}>{msg.username}</span>
          {msg.isAdmin && <span className="rounded bg-purple-500/30 px-1 py-0.5 text-[10px] text-purple-300">{t("admin:adminBadge")}</span>}
          <span className="text-white/30">{new Date(msg.createdAt).toLocaleString()}</span></div>
        <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p></div>))}</div>
    {ticket.status !== "closed" && <form onSubmit={handleReply} className="mt-4">
      <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t("admin:replyAsAdmin")} rows={3}
        className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none" />
      <button type="submit" disabled={rMut.isPending || !reply.trim()} className="mt-2 rounded-lg bg-tentacle-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50">
        {rMut.isPending ? t("common:sending") : t("admin:reply")}</button></form>}
  </div>);
}

export function AdminTickets() {
  const { t } = useTranslation("admin");
  const labels: Record<string, string> = {
    open: t("admin:ticketOpen"), in_progress: t("admin:ticketInProgress"),
    resolved: t("admin:ticketResolved"), closed: t("admin:ticketClosed"),
  };
  const [filter, setFilter] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const { data } = useAllTickets(filter || undefined);
  const tickets = data?.results ?? [];
  if (selId) return <div className={cls.card}><TicketDetail id={selId} onBack={() => setSelId(null)} /></div>;
  return (
    <div className={cls.card}>
      <h2 className="mb-4 text-lg font-semibold text-white">{t("admin:supportTickets")}</h2>
      <div className="mb-4 flex gap-2">{[{ k: "", l: t("admin:ticketAll") }, { k: "open", l: labels.open }, { k: "in_progress", l: labels.in_progress }, { k: "resolved", l: labels.resolved }].map(f =>
        <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.k ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>{f.l}</button>)}</div>
      {tickets.length === 0 ? <p className="text-sm text-white/40">{t("admin:noTickets")}</p> : <div className="space-y-2">{tickets.map((tk: SupportTicket) => {
        const s = TICKET_STYLES[tk.status]; return (
          <div key={tk.id} onClick={() => setSelId(tk.id)} className="flex cursor-pointer items-center gap-4 rounded-lg border border-white/5 p-3 hover:bg-white/5">
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{tk.subject}</p>
              <p className="text-xs text-white/40">{tk.username} — {new Date(tk.updatedAt).toLocaleDateString()}</p>
              {tk.mediaItemName && <p className="mt-0.5 text-xs text-purple-400 truncate">{tk.mediaItemName}</p>}</div>
            {s && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${s.c}`}>{labels[tk.status]}</span>}</div>);
      })}</div>}
    </div>
  );
}
