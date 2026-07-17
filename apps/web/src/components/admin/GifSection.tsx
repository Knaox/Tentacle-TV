import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

/**
 * Section « GIFs du chat (Tenor) » — clé API du proxy /api/gifs (chat Watch
 * Together). Stockée en DB (config `tenor_api_key`, prioritaire) ; repli sur
 * la variable d'env TENOR_API_KEY. La clé n'est JAMAIS relue depuis le
 * serveur : seul l'état configuré / sa source est affiché. Le bouton
 * « Tester et sauvegarder » valide la clé par un appel réel à Tenor.
 */

interface GifConfigState {
  configured: boolean;
  dbConfigured: boolean;
  envFallback: boolean;
}

const CONSOLE_URL = "https://console.cloud.google.com/apis/library/tenor.googleapis.com";
const DOCS_URL = "https://developers.google.com/tenor/guides/quickstart";

export function GifSection() {
  const { t } = useTranslation("admin");
  const [state, setState] = useState<GifConfigState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/gif-config`, { headers: hdrs(), credentials: creds() });
      if (r.ok) setState((await r.json()) as GifConfigState);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/gif-config`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({ apiKey: apiKey.trim() }),
        credentials: creds(),
      });
      if (r.ok) {
        setMsg({ ok: true, t: t("saved") });
        setApiKey("");
        await load();
      } else {
        const d = (await r.json().catch(() => null)) as { message?: string } | null;
        setMsg({ ok: false, t: d?.message || t("gifsKeyInvalid") });
      }
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  const clear = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/gif-config`, {
        method: "DELETE",
        headers: hdrs(),
        credentials: creds(),
      });
      setMsg(r.ok ? { ok: true, t: t("gifsCleared") } : { ok: false, t: t("saveFailed") });
      await load();
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  if (!state) return null;
  return (
    <div className={cls.card}>
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white">{t("gifsTitle")}</h2>
        <span className={`${cls.chip} ${state.configured ? "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]" : "bg-white/10 text-white/50"}`}>
          {state.configured ? t("statusConnected") : t("statusNotConfigured")}
        </span>
      </div>
      <p className="mb-4 text-sm text-white/40">{t("gifsDescription")}</p>

      <div className={cls.sub}>
        <label className={cls.lbl}>{t("gifsKeyLabel")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="password"
            autoComplete="off"
            placeholder={t("gifsKeyPlaceholder")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className={`${cls.inp} min-w-[260px] flex-1`}
          />
          <button onClick={save} disabled={busy || apiKey.trim().length < 10} className={cls.bp} style={cls.bpStyle}>
            {busy ? "..." : t("gifsSaveAndTest")}
          </button>
          {state.dbConfigured && (
            <button onClick={clear} disabled={busy} className={cls.bd}>{t("gifsClearKey")}</button>
          )}
          {msg && <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>}
        </div>
        {!state.dbConfigured && state.envFallback && (
          <p className="mt-1 text-xs text-white/30">{t("gifsStatusEnvFallback")}</p>
        )}

        <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-1.5 text-xs font-semibold text-white/60">{t("gifsHowTo")}</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-white/40">
            <li>{t("gifsStep1")}</li>
            <li>{t("gifsStep2")}</li>
            <li>{t("gifsStep3")}</li>
          </ol>
          <div className="mt-2 flex flex-wrap gap-4">
            <a href={CONSOLE_URL} target="_blank" rel="noreferrer" className="text-xs font-medium text-purple-300 hover:text-purple-200 hover:underline">
              {t("gifsOpenConsole")} ↗
            </a>
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="text-xs font-medium text-purple-300 hover:text-purple-200 hover:underline">
              {t("gifsOpenDocs")} ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
