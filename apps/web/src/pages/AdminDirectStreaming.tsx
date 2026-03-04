import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls } from "./adminUtils";

export function DirectStreamingSection() {
  const { t } = useTranslation("admin");
  const [enabled, setEnabled] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [privateUrl, setPrivateUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/admin/direct-streaming`, { headers: hdrs() });
        if (r.ok) {
          const d = await r.json();
          setEnabled(d.enabled ?? false);
          setPublicUrl(d.publicUrl ?? "");
          setPrivateUrl(d.privateUrl ?? "");
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    if (enabled && (!publicUrl.trim() || !privateUrl.trim())) {
      setMsg({ ok: false, t: t("admin:directStreamingUrlRequired") });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/direct-streaming`, {
        method: "PUT", headers: hdrs(),
        body: JSON.stringify({ enabled, publicUrl: publicUrl.trim(), privateUrl: privateUrl.trim() }),
      });
      if (r.ok) {
        setMsg({ ok: true, t: t("admin:saved") });
      } else {
        const d = await r.json().catch(() => ({}));
        setMsg({ ok: false, t: d.message || t("admin:saveFailed") });
      }
    } catch { setMsg({ ok: false, t: t("admin:saveFailed") }); }
    setBusy(false);
  };

  if (!loaded) return null;
  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-white">{t("admin:directStreaming")}</h2>
      <p className="mb-4 text-sm text-white/40">{t("admin:directStreamingDescription")}</p>
      <div className={cls.sub}>
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only" />
            <div className="h-5 w-9 rounded-full bg-white/10 transition-colors peer-checked:bg-purple-600" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-sm text-white">{t("admin:directStreamingEnabled")}</span>
        </label>

        <div className={`space-y-3 transition-opacity ${enabled ? "opacity-100" : "pointer-events-none opacity-40"}`}>
          <div>
            <label className={cls.lbl}>{t("admin:directStreamingPublicUrl")}</label>
            <input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)}
              placeholder="https://jf.example.com" className={cls.inp} />
            <p className="mt-1 text-xs text-white/30">{t("admin:directStreamingPublicUrlHelp")}</p>
          </div>
          <div>
            <label className={cls.lbl}>{t("admin:directStreamingPrivateUrl")}</label>
            <input value={privateUrl} onChange={(e) => setPrivateUrl(e.target.value)}
              placeholder="http://192.168.1.50:8096" className={cls.inp} />
            <p className="mt-1 text-xs text-white/30">{t("admin:directStreamingPrivateUrlHelp")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className={cls.bp}>
            {busy ? "..." : t("admin:save")}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</span>}
        </div>
      </div>
    </div>
  );
}
