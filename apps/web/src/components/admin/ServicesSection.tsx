import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

interface DbFields { host: string; port: number; database: string; user: string }
interface SvcData {
  jellyfin: { status: string; url: string; version: string };
  database: { status: string; fromEnv: boolean; fields?: DbFields };
}

const dot = (s: string) =>
  `inline-block h-2 w-2 rounded-full mr-1.5 ${s === "connected" ? "bg-[var(--status-success-fg)]" : s === "error" ? "bg-[var(--status-error-fg)]" : "bg-white/30"}`;

/**
 * Section "Services" admin (Jellyfin + DB + reset). Extraite depuis Admin.tsx
 * pour respect 300L/fichier. Layout responsive grille 1→2→3 colonnes.
 */
export function ServicesSection() {
  const { t } = useTranslation("admin");
  const sLabel = (s: string) =>
    s === "connected" ? t("statusConnected")
      : s === "error" ? t("statusError")
        : s === "not_configured" ? t("statusNotConfigured")
          : t("statusDisconnected");

  const [d, setD] = useState<SvcData | null>(null);
  const [jUrl, setJUrl] = useState("");
  const [jKey, setJKey] = useState("");
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("3306");
  const [dbName, setDbName] = useState("tentacle");
  const [dbUser, setDbUser] = useState("");
  const [dbPass, setDbPass] = useState("");
  const [jMsg, setJMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [dbMsg, setDbMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/services`, { headers: hdrs(), credentials: creds() });
      if (r.ok) {
        const j: SvcData = await r.json();
        setD(j);
        if (j.jellyfin.url) setJUrl(j.jellyfin.url);
        if (j.database.fields) {
          setDbHost(j.database.fields.host);
          setDbPort(String(j.database.fields.port));
          setDbName(j.database.fields.database);
          setDbUser(j.database.fields.user);
        }
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const aFetch = async (path: string, method: string, body?: object) => {
    const h: Record<string, string> = { ...hdrs() };
    if (!body) delete h["Content-Type"];
    const r = await fetch(`${BACKEND}/api/admin${path}`, {
      method,
      headers: h,
      credentials: creds(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, d: j, msg: j.message || (r.ok ? "OK" : t("statusError")) };
  };

  const testJ = async () => {
    setBusy("tj"); setJMsg(null);
    const r = await aFetch("/test-jellyfin", "POST", { url: jUrl, apiKey: jKey });
    setJMsg({ ok: r.ok, t: r.ok ? `Jellyfin ${r.d.version || ""} - ${r.d.serverName || ""}` : r.msg });
    setBusy("");
  };
  const saveJ = async () => {
    setBusy("sj"); setJMsg(null);
    const r = await aFetch("/jellyfin", "PUT", { url: jUrl, apiKey: jKey });
    setJMsg({ ok: r.ok, t: r.ok ? t("save") : r.msg });
    if (r.ok) await load();
    setBusy("");
  };
  const saveDb = async () => {
    setBusy("sdb"); setDbMsg(null);
    const r = await aFetch("/database", "PUT", { host: dbHost, port: Number(dbPort), database: dbName, user: dbUser, password: dbPass });
    setDbMsg({ ok: r.ok, t: r.ok ? t("dbRestartNote") : r.msg });
    setBusy("");
  };
  const resetServer = async () => {
    setBusy("rst");
    const r = await aFetch("/reset-server", "POST", {});
    if (r.ok) { localStorage.removeItem("tentacle_user"); window.location.reload(); }
    else { setDbMsg({ ok: false, t: r.msg }); }
    setBusy("");
    setResetConfirm(false);
  };

  if (!d) {
    return (
      <div className={cls.card}>
        <h2 className="text-lg font-semibold text-white">{t("services")}</h2>
        <p className="mt-2 text-sm text-white/40">{t("loading", { ns: "common" })}</p>
      </div>
    );
  }

  const Msg = ({ m }: { m: { ok: boolean; t: string } | null }) =>
    m ? <span className={`text-xs ${m.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{m.t}</span> : null;

  return (
    <div className={`${cls.card} space-y-6`}>
      <h2 className="text-lg font-semibold text-white">{t("services")}</h2>

      {/* Jellyfin */}
      <div className={cls.sub}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={dot(d.jellyfin.status)} />
          <span className="text-sm font-medium text-white">{t("jellyfin")}</span>
          <span className="text-xs text-white/40">{sLabel(d.jellyfin.status)}</span>
          {d.jellyfin.version && <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-xs text-white/50">v{d.jellyfin.version}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={cls.lbl}>{t("serverUrl")}</label>
            <input value={jUrl} onChange={(e) => setJUrl(e.target.value)} placeholder="http://localhost:8096" className={cls.inp} />
          </div>
          <div>
            <label className={cls.lbl}>{t("apiKey")}</label>
            <input value={jKey} onChange={(e) => setJKey(e.target.value)} placeholder={t("apiKey")} className={cls.inp} type="password" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={testJ} disabled={!!busy || !jUrl || !jKey} className={cls.bs}>{busy === "tj" ? `${t("test")}...` : t("test")}</button>
          <button onClick={saveJ} disabled={!!busy || !jUrl || !jKey} className={cls.bp} style={cls.bpStyle}>{busy === "sj" ? "..." : t("save")}</button>
          <Msg m={jMsg} />
        </div>
      </div>

      {/* Database */}
      <div className={cls.sub}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={dot(d.database.status)} />
          <span className="text-sm font-medium text-white">{t("database")}</span>
          <span className="text-xs text-white/40">{sLabel(d.database.status)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={cls.lbl}>{t("dbHost")}</label>
            <input value={dbHost} onChange={(e) => setDbHost(e.target.value)} placeholder="localhost" className={cls.inp} />
          </div>
          <div>
            <label className={cls.lbl}>{t("dbPort")}</label>
            <input value={dbPort} onChange={(e) => setDbPort(e.target.value)} placeholder="3306" className={cls.inp} />
          </div>
        </div>
        <div>
          <label className={cls.lbl}>{t("dbName")}</label>
          <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="tentacle" className={cls.inp} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={cls.lbl}>{t("dbUser")}</label>
            <input value={dbUser} onChange={(e) => setDbUser(e.target.value)} className={cls.inp} />
          </div>
          <div>
            <label className={cls.lbl}>{t("dbPassword")}</label>
            <input value={dbPass} onChange={(e) => setDbPass(e.target.value)} type="password" className={cls.inp} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={saveDb} disabled={!!busy || !dbHost || !dbUser || !dbPass} className={cls.bp} style={cls.bpStyle}>{busy === "sdb" ? "..." : t("save")}</button>
          <Msg m={dbMsg} />
        </div>
        <p className="text-xs text-[var(--status-warning-fg)]/80">{t("dbRestartNote")}</p>

        {/* Reset server */}
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)} disabled={!!busy}
              className={cls.bd}>
              {t("resetServer")}
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error-bg)] p-4">
              <p className="text-sm font-medium text-[var(--status-error-fg)]">{t("resetConfirmTitle")}</p>
              <p className="text-xs text-white/50">{t("resetConfirmMessage")}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={resetServer} disabled={!!busy}
                  className={cls.bd}>
                  {busy === "rst" ? t("resetting") : t("resetConfirm")}
                </button>
                <button onClick={() => setResetConfirm(false)} disabled={!!busy}
                  className={cls.bs}>
                  {t("cancel", { ns: "common" })}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
