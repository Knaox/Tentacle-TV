import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus } from "@tentacle-tv/api-client";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { cls } from "./adminUtils";

const TICKET_STYLES: Record<string, { c: string }> = {
  open: { c: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]" },
  in_progress: { c: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)]" },
  resolved: { c: "bg-[var(--brand-soft)] text-[var(--brand-light)]" },
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
      {st && <span className={`${cls.chip} ${st.c}`}>{labels[ticket.status]}</span>}</div>
    {ticket.mediaItemName && <p className="mb-3 text-xs text-[var(--brand-light)]">{ticket.mediaItemName}</p>}
    <div className="mb-4 flex flex-wrap gap-2">{(["open","in_progress","resolved","closed"] as const).map(s =>
      <button key={s} onClick={() => sMut.mutate({ ticketId: id, status: s })} disabled={ticket.status === s}
        className={ticket.status === s ? cls.bbrand : cls.bs}>{labels[s]}</button>)}</div>
    <div className="max-h-80 space-y-2 overflow-y-auto">{ticket.messages?.map(msg => (
      <div key={msg.id} className={`rounded-lg p-3 ${msg.isAdmin ? "border border-[var(--brand)]/20 bg-[var(--brand-soft)]" : "bg-white/5"}`}>
        <div className="mb-1 flex items-center gap-2 text-xs"><span className={msg.isAdmin ? "font-medium text-[var(--brand-light)]" : "text-white/70"}>{msg.username}</span>
          {msg.isAdmin && <span className="rounded bg-[var(--brand-soft)] px-1 py-0.5 text-[10px] text-[var(--brand-light)]">{t("admin:adminBadge")}</span>}
          <span className="text-white/30">{new Date(msg.createdAt).toLocaleString()}</span></div>
        <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p></div>))}</div>
    {ticket.status !== "closed" && <form onSubmit={handleReply} className="mt-4">
      <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t("admin:replyAsAdmin")} rows={3}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30 resize-none" />
      <button type="submit" disabled={rMut.isPending || !reply.trim()} className={`${cls.bp} mt-2`} style={cls.bpStyle}>
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
      <div className="mb-4 flex flex-wrap gap-2">{[{ k: "", l: t("admin:ticketAll") }, { k: "open", l: labels.open }, { k: "in_progress", l: labels.in_progress }, { k: "resolved", l: labels.resolved }].map(f =>
        <button key={f.k} onClick={() => setFilter(f.k)} className={filter === f.k ? cls.bbrand : cls.bs}>{f.l}</button>)}</div>
      {tickets.length === 0 ? <p className="text-sm text-white/40">{t("admin:noTickets")}</p> : <div className="space-y-2">{tickets.map((tk: SupportTicket) => {
        const s = TICKET_STYLES[tk.status]; return (
          <div key={tk.id} onClick={() => setSelId(tk.id)} className="flex cursor-pointer items-center gap-4 rounded-lg border border-white/[0.06] p-3 hover:bg-white/5">
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{tk.subject}</p>
              <p className="text-xs text-white/40">{tk.username} — {new Date(tk.updatedAt).toLocaleDateString()}</p>
              {tk.mediaItemName && <p className="mt-0.5 text-xs text-[var(--brand-light)] truncate">{tk.mediaItemName}</p>}</div>
            {s && <span className={`${cls.chip} ${s.c}`}>{labels[tk.status]}</span>}</div>);
      })}</div>}
    </div>
  );
}
