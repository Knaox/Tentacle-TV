import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus, usePairedDevices, useRevokePairedDevice } from "@tentacle-tv/api-client";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { backendUrl } from "../main";

const BACKEND = backendUrl;
const hdrs = () => {
  const tok = localStorage.getItem("tentacle_token");
  return { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
};
const cls = {
  card: "mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6",
  sub: "rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3",
  inp: "w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-purple-500",
  lbl: "mb-1 block text-xs text-white/40",
  bp: "rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition",
  bs: "rounded-lg bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-40 transition",
  bd: "rounded-lg bg-red-600/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-40 transition",
};
interface InviteKey {
  id: number; key: string; maxUses: number; currentUses: number;
  expiresAt: string | null; createdAt: string; usages: { username: string; usedAt: string }[];
}

export function Admin() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresHours, setExpiresHours] = useState(72);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fetchInvites = useCallback(async () => {
    const r = await fetch(`${BACKEND}/api/invites`, { headers: hdrs() }); if (r.ok) setInvites(await r.json());
  }, []);
  useEffect(() => { fetchInvites(); }, [fetchInvites]);
  const createInvite = async () => {
    setCreating(true);
    const r = await fetch(`${BACKEND}/api/invites`, { method: "POST", headers: hdrs(), body: JSON.stringify({ maxUses, expiresInHours: expiresHours }) });
    if (r.ok) await fetchInvites(); setCreating(false);
  };
  const copyLink = (key: string) => { navigator.clipboard.writeText(`${window.location.origin}/register?invite=${key}`); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); };

  return (
    <div className="px-4 pt-6 pb-16 md:px-12"><div className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-2xl font-bold text-white">{t("admin:title")}</h1>

      {/* Plugins shortcut */}
      <div className={cls.card}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Plugins</h2>
            <p className="mt-1 text-sm text-white/40">Gerez vos plugins, explorez le marketplace et ajoutez des sources.</p>
          </div>
          <button
            onClick={() => navigate("/admin/plugins")}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
          >
            Gerer les plugins
          </button>
        </div>
      </div>

      <ServicesSection />
      <PairedDevicesSection />
      <div className={cls.card}>
        <h2 className="mb-4 text-lg font-semibold text-white">{t("admin:generateInvite")}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className={cls.lbl}>{t("admin:maxUses")}</label>
            <input type="number" min={1} max={100} value={maxUses} onChange={e => setMaxUses(+e.target.value)} className="w-24 rounded-lg bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-tentacle-accent" /></div>
          <div><label className={cls.lbl}>{t("admin:expiresInHours")}</label>
            <input type="number" min={1} max={720} value={expiresHours} onChange={e => setExpiresHours(+e.target.value)} className="w-24 rounded-lg bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-tentacle-accent" /></div>
          <button onClick={createInvite} disabled={creating} className="rounded-lg bg-tentacle-accent px-5 py-2 font-semibold text-white transition-transform hover:scale-105 disabled:opacity-50">{creating ? "..." : t("admin:generate")}</button>
        </div>
      </div>
      <AdminTickets />
      <div className={cls.card}>
        <h2 className="mb-4 text-lg font-semibold text-white">{t("admin:existingInvites")}</h2>
        {invites.length === 0 ? <p className="text-sm text-white/40">{t("admin:noInvites")}</p> : <div className="space-y-3">{invites.map(inv => {
          const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date(), full = inv.currentUses >= inv.maxUses, active = !expired && !full;
          return (<div key={inv.id} className={`rounded-lg border p-4 ${active ? "border-white/10" : "border-white/5 opacity-50"}`}><div className="flex items-center justify-between gap-4"><div>
            <code className="text-sm font-mono text-tentacle-accent-light">{inv.key}</code>
            <div className="mt-1 flex items-center gap-3 text-xs text-white/40"><span>{t("admin:usesCount", { current: inv.currentUses, max: inv.maxUses })}</span>
              {inv.expiresAt && <span>{expired ? t("admin:expiresOn", { date: new Date(inv.expiresAt).toLocaleDateString("fr-FR") }) : t("admin:expiresOn", { date: new Date(inv.expiresAt).toLocaleDateString("fr-FR") })}</span>}
              <span>{t("admin:createdOn", { date: new Date(inv.createdAt).toLocaleDateString("fr-FR") })}</span></div>
            {inv.usages.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{inv.usages.map(u => <span key={u.username} className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/50">{u.username}</span>)}</div>}
          </div>{active && <button onClick={() => copyLink(inv.key)} className="flex-shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white">{copiedKey === inv.key ? t("admin:copied") : t("admin:copyLink")}</button>}</div></div>);
        })}</div>}
      </div>
    </div></div>
  );
}

/* ── Services ── */
interface DbFields { host: string; port: number; database: string; user: string }
interface SvcData { jellyfin: { status: string; url: string; version: string }; seerr: { status: string; url: string }; database: { status: string; fromEnv: boolean; fields?: DbFields }; }
const dot = (s: string) => `inline-block h-2 w-2 rounded-full mr-1.5 ${s === "connected" ? "bg-green-400" : s === "error" ? "bg-red-400" : "bg-white/30"}`;

function ServicesSection() {
  const { t } = useTranslation("admin");
  const sLabel = (s: string) => s === "connected" ? t("admin:statusConnected") : s === "error" ? t("admin:statusError") : s === "not_configured" ? t("admin:statusNotConfigured") : t("admin:statusDisconnected");

  const [d, setD] = useState<SvcData | null>(null);
  const [jUrl, setJUrl] = useState(""); const [jKey, setJKey] = useState("");
  const [sUrl, setSUrl] = useState(""); const [sKey, setSKey] = useState("");
  const [dbHost, setDbHost] = useState("localhost"); const [dbPort, setDbPort] = useState("3306");
  const [dbName, setDbName] = useState("tentacle"); const [dbUser, setDbUser] = useState("");
  const [dbPass, setDbPass] = useState("");
  const [jMsg, setJMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [sMsg, setSMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [dbMsg, setDbMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/services`, { headers: hdrs() });
      if (r.ok) {
        const j: SvcData = await r.json(); setD(j);
        if (j.jellyfin.url) setJUrl(j.jellyfin.url);
        if (j.seerr.url) setSUrl(j.seerr.url);
        if (j.database.fields) {
          setDbHost(j.database.fields.host); setDbPort(String(j.database.fields.port));
          setDbName(j.database.fields.database); setDbUser(j.database.fields.user);
        }
      }
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const aFetch = async (path: string, method: string, body?: object) => {
    const h: Record<string, string> = {};
    const tok = localStorage.getItem("tentacle_token");
    if (tok) h["Authorization"] = `Bearer ${tok}`;
    if (body) h["Content-Type"] = "application/json";
    const r = await fetch(`${BACKEND}/api/admin${path}`, { method, headers: h, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, d: j, msg: j.message || (r.ok ? "OK" : t("admin:statusError")) };
  };
  const testJ = async () => { setBusy("tj"); setJMsg(null); const r = await aFetch("/test-jellyfin", "POST", { url: jUrl, apiKey: jKey }); setJMsg({ ok: r.ok, t: r.ok ? `Jellyfin ${r.d.version || ""} - ${r.d.serverName || ""}` : r.msg }); setBusy(""); };
  const saveJ = async () => { setBusy("sj"); setJMsg(null); const r = await aFetch("/jellyfin", "PUT", { url: jUrl, apiKey: jKey }); setJMsg({ ok: r.ok, t: r.ok ? t("admin:save") : r.msg }); if (r.ok) await load(); setBusy(""); };
  const testS = async () => { setBusy("ts"); setSMsg(null); const r = await aFetch("/test-seerr", "POST", { url: sUrl, apiKey: sKey }); setSMsg({ ok: r.ok, t: r.ok ? t("admin:seerrConnectionSuccess") : r.msg }); setBusy(""); };
  const saveS = async () => { setBusy("ss"); setSMsg(null); const r = await aFetch("/seerr", "PUT", { url: sUrl, apiKey: sKey }); setSMsg({ ok: r.ok, t: r.ok ? t("admin:save") : r.msg }); if (r.ok) await load(); setBusy(""); };
  const delS = async () => { if (!confirm(t("admin:seerrDeleteWarning"))) return; setBusy("ds"); setSMsg(null); const r = await aFetch("/seerr", "DELETE"); setSMsg({ ok: r.ok, t: r.ok ? t("admin:delete") : r.msg }); if (r.ok) { setSUrl(""); setSKey(""); await load(); } setBusy(""); };
  const saveDb = async () => { setBusy("sdb"); setDbMsg(null); const r = await aFetch("/database", "PUT", { host: dbHost, port: Number(dbPort), database: dbName, user: dbUser, password: dbPass }); setDbMsg({ ok: r.ok, t: r.ok ? t("admin:dbRestartNote") : r.msg }); setBusy(""); };
  const [resetConfirm, setResetConfirm] = useState(false);
  const resetServer = async () => { setBusy("rst"); const r = await aFetch("/reset-server", "POST", {}); if (r.ok) { localStorage.removeItem("tentacle_token"); localStorage.removeItem("tentacle_user"); window.location.reload(); } else { setDbMsg({ ok: false, t: r.msg }); } setBusy(""); setResetConfirm(false); };

  if (!d) return <div className={cls.card}><h2 className="text-lg font-semibold text-white">{t("admin:services")}</h2><p className="mt-2 text-sm text-white/40">{t("common:loading")}</p></div>;
  const Msg = ({ m }: { m: { ok: boolean; t: string } | null }) => m ? <span className={`text-xs ${m.ok ? "text-green-400" : "text-red-400"}`}>{m.t}</span> : null;
  return (
    <div className={`${cls.card} space-y-6`}>
      <h2 className="text-lg font-semibold text-white">{t("admin:services")}</h2>
      <div className={cls.sub}>
        <div className="flex items-center gap-2"><span className={dot(d.jellyfin.status)} /><span className="text-sm font-medium text-white">{t("admin:jellyfin")}</span><span className="text-xs text-white/40">{sLabel(d.jellyfin.status)}</span>
          {d.jellyfin.version && <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-xs text-white/50">v{d.jellyfin.version}</span>}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className={cls.lbl}>{t("admin:serverUrl")}</label><input value={jUrl} onChange={e => setJUrl(e.target.value)} placeholder="http://localhost:8096" className={cls.inp} /></div>
          <div><label className={cls.lbl}>{t("admin:apiKey")}</label><input value={jKey} onChange={e => setJKey(e.target.value)} placeholder={t("admin:apiKey")} className={cls.inp} type="password" /></div>
        </div>
        <div className="flex items-center gap-2"><button onClick={testJ} disabled={!!busy || !jUrl || !jKey} className={cls.bs}>{busy === "tj" ? `${t("admin:test")}...` : t("admin:test")}</button>
          <button onClick={saveJ} disabled={!!busy || !jUrl || !jKey} className={cls.bp}>{busy === "sj" ? "..." : t("admin:save")}</button><Msg m={jMsg} /></div>
      </div>
      <div className={cls.sub}>
        <div className="flex items-center gap-2"><span className={dot(d.seerr.status)} /><span className="text-sm font-medium text-white">{t("admin:seerr")}</span><span className="text-xs text-white/40">{sLabel(d.seerr.status)}</span>
          <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-xs text-white/30">{t("admin:seerrOptional")}</span></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className={cls.lbl}>{t("admin:serverUrl")}</label><input value={sUrl} onChange={e => setSUrl(e.target.value)} placeholder="http://localhost:5055" className={cls.inp} /></div>
          <div><label className={cls.lbl}>{t("admin:apiKey")}</label><input value={sKey} onChange={e => setSKey(e.target.value)} placeholder={t("admin:apiKey")} className={cls.inp} type="password" /></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap"><button onClick={testS} disabled={!!busy || !sUrl || !sKey} className={cls.bs}>{busy === "ts" ? `${t("admin:test")}...` : t("admin:test")}</button>
          <button onClick={saveS} disabled={!!busy || !sUrl || !sKey} className={cls.bp}>{busy === "ss" ? "..." : t("admin:save")}</button>
          {d.seerr.status !== "not_configured" && <button onClick={delS} disabled={!!busy} className={cls.bd}>{busy === "ds" ? "..." : t("admin:delete")}</button>}<Msg m={sMsg} /></div>
        <p className="text-xs text-white/30">{t("admin:seerrDeleteWarning")}</p>
      </div>
      <div className={cls.sub}>
        <div className="flex items-center gap-2"><span className={dot(d.database.status)} /><span className="text-sm font-medium text-white">{t("admin:database")}</span><span className="text-xs text-white/40">{sLabel(d.database.status)}</span></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className={cls.lbl}>{t("admin:dbHost")}</label><input value={dbHost} onChange={e => setDbHost(e.target.value)} placeholder="localhost" className={cls.inp} /></div>
          <div><label className={cls.lbl}>{t("admin:dbPort")}</label><input value={dbPort} onChange={e => setDbPort(e.target.value)} placeholder="3306" className={cls.inp} /></div>
        </div>
        <div><label className={cls.lbl}>{t("admin:dbName")}</label><input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="tentacle" className={cls.inp} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className={cls.lbl}>{t("admin:dbUser")}</label><input value={dbUser} onChange={e => setDbUser(e.target.value)} className={cls.inp} /></div>
          <div><label className={cls.lbl}>{t("admin:dbPassword")}</label><input value={dbPass} onChange={e => setDbPass(e.target.value)} type="password" className={cls.inp} /></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveDb} disabled={!!busy || !dbHost || !dbUser || !dbPass} className={cls.bp}>{busy === "sdb" ? "..." : t("admin:save")}</button>
          <Msg m={dbMsg} />
        </div>
        <p className="text-xs text-amber-400/70">{t("admin:dbRestartNote")}</p>
        <div className="mt-4 border-t border-white/10 pt-4">
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)} disabled={!!busy}
              className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-600/30 transition">
              {t("admin:resetServer")}
            </button>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
              <p className="text-sm font-medium text-red-400">{t("admin:resetConfirmTitle")}</p>
              <p className="text-xs text-white/50">{t("admin:resetConfirmMessage")}</p>
              <div className="flex gap-2">
                <button onClick={resetServer} disabled={!!busy}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition">
                  {busy === "rst" ? t("admin:resetting") : t("admin:resetConfirm")}
                </button>
                <button onClick={() => setResetConfirm(false)} disabled={!!busy}
                  className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-medium text-white/70 hover:bg-white/20 transition">
                  {t("common:cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Paired Devices ── */
function PairedDevicesSection() {
  const { t } = useTranslation("admin");
  const { data: devices } = usePairedDevices();
  const revokeMut = useRevokePairedDevice();

  return (
    <div className={cls.card}>
      <h2 className="mb-4 text-lg font-semibold text-white">{t("admin:pairedDevices")}</h2>
      {!devices || devices.length === 0 ? (
        <p className="text-sm text-white/40">{t("admin:noPairedDevices")}</p>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between rounded-lg border border-white/10 p-4">
              <div>
                <p className="text-sm font-medium text-white">{device.name}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                  <span>{device.username}</span>
                  <span>{t("admin:lastActivity", { date: new Date(device.lastSeen).toLocaleDateString("fr-FR") })}</span>
                  <span>{t("admin:pairedOn", { date: new Date(device.createdAt).toLocaleDateString("fr-FR") })}</span>
                </div>
              </div>
              <button
                onClick={() => { if (confirm(t("admin:revokeConfirm"))) revokeMut.mutate(device.id); }}
                disabled={revokeMut.isPending}
                className={cls.bd}
              >
                {t("admin:revoke")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tickets ── */
function AdminTickets() {
  const { t } = useTranslation("admin");
  const TS: Record<string, { l: string; c: string }> = { open: { l: t("admin:ticketOpen"), c: "bg-green-500/20 text-green-400" }, in_progress: { l: t("admin:ticketInProgress"), c: "bg-blue-500/20 text-blue-400" }, resolved: { l: t("admin:ticketResolved"), c: "bg-purple-500/20 text-purple-400" }, closed: { l: t("admin:ticketClosed"), c: "bg-white/10 text-white/40" } };

  const [filter, setFilter] = useState(""); const [selId, setSelId] = useState<string | null>(null);
  const { data } = useAllTickets(filter || undefined); const tickets = data?.results ?? [];
  if (selId) return <div className={cls.card}><TicketDetail id={selId} onBack={() => setSelId(null)} /></div>;
  return (
    <div className={cls.card}>
      <h2 className="mb-4 text-lg font-semibold text-white">{t("admin:supportTickets")}</h2>
      <div className="mb-4 flex gap-2">{[{ k: "", l: t("admin:ticketAll") }, { k: "open", l: t("admin:ticketOpen") }, { k: "in_progress", l: t("admin:ticketInProgress") }, { k: "resolved", l: t("admin:ticketResolved") }].map(f =>
        <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.k ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>{f.l}</button>)}</div>
      {tickets.length === 0 ? <p className="text-sm text-white/40">{t("admin:noTickets")}</p> : <div className="space-y-2">{tickets.map((tk: SupportTicket) => {
        const s = TS[tk.status]; return (
          <div key={tk.id} onClick={() => setSelId(tk.id)} className="flex cursor-pointer items-center gap-4 rounded-lg border border-white/5 p-3 hover:bg-white/5">
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{tk.subject}</p>
              <p className="text-xs text-white/40">{tk.username} — {new Date(tk.updatedAt).toLocaleDateString("fr-FR")}</p>
              {tk.mediaItemName && <p className="mt-0.5 text-xs text-purple-400 truncate">{tk.mediaItemName}</p>}</div>
            {s && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${s.c}`}>{s.l}</span>}</div>);
      })}</div>}
    </div>
  );
}

function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation("admin");
  const TS: Record<string, { l: string; c: string }> = { open: { l: t("admin:ticketOpen"), c: "bg-green-500/20 text-green-400" }, in_progress: { l: t("admin:ticketInProgress"), c: "bg-blue-500/20 text-blue-400" }, resolved: { l: t("admin:ticketResolved"), c: "bg-purple-500/20 text-purple-400" }, closed: { l: t("admin:ticketClosed"), c: "bg-white/10 text-white/40" } };

  const { data: ticket } = useTicketDetail(id); const [reply, setReply] = useState("");
  const rMut = useReplyTicket(); const sMut = useUpdateTicketStatus();
  if (!ticket) return <p className="text-white/40">{t("common:loading")}</p>;
  const handleReply = (e: React.FormEvent) => { e.preventDefault(); if (!reply.trim()) return; rMut.mutate({ ticketId: id, body: reply.trim() }, { onSuccess: () => setReply("") }); };
  const st = TS[ticket.status];
  return (<div>
    <button onClick={onBack} className="mb-3 text-sm text-white/50 hover:text-white">&larr; {t("common:back")}</button>
    <div className="mb-4 flex items-center gap-3"><h3 className="text-base font-semibold text-white">{ticket.subject}</h3>
      {st && <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${st.c}`}>{st.l}</span>}</div>
    {ticket.mediaItemName && <p className="mb-3 text-xs text-purple-400">{ticket.mediaItemName}</p>}
    <div className="mb-4 flex gap-2">{(["open","in_progress","resolved","closed"] as const).map(s =>
      <button key={s} onClick={() => sMut.mutate({ ticketId: id, status: s })} disabled={ticket.status === s}
        className={`rounded-lg px-3 py-1 text-xs ${ticket.status === s ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"} disabled:opacity-50`}>{TS[s].l}</button>)}</div>
    <div className="max-h-80 space-y-2 overflow-y-auto">{ticket.messages?.map(msg => (
      <div key={msg.id} className={`rounded-lg p-3 ${msg.isAdmin ? "border border-purple-500/20 bg-purple-500/10" : "bg-white/5"}`}>
        <div className="mb-1 flex items-center gap-2 text-xs"><span className={msg.isAdmin ? "font-medium text-purple-400" : "text-white/70"}>{msg.username}</span>
          {msg.isAdmin && <span className="rounded bg-purple-500/30 px-1 py-0.5 text-[10px] text-purple-300">Admin</span>}
          <span className="text-white/30">{new Date(msg.createdAt).toLocaleString("fr-FR")}</span></div>
        <p className="whitespace-pre-wrap text-sm text-white/80">{msg.body}</p></div>))}</div>
    {ticket.status !== "closed" && <form onSubmit={handleReply} className="mt-4">
      <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t("admin:replyAsAdmin")} rows={3}
        className="w-full rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none" />
      <button type="submit" disabled={rMut.isPending || !reply.trim()} className="mt-2 rounded-lg bg-tentacle-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-tentacle-accent/80 disabled:opacity-50">
        {rMut.isPending ? t("common:sending") : t("admin:reply")}</button></form>}
  </div>);
}
