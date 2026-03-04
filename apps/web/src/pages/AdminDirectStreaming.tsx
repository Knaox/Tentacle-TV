import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls } from "./adminUtils";

interface TestResult { ok: boolean; version?: string; error?: string }
interface TestResponse { public: TestResult | null; private: TestResult | null }

export function DirectStreamingSection() {
  const { t } = useTranslation("admin");
  const [enabled, setEnabled] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [privateUrl, setPrivateUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);

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

  const testUrls = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/test-direct-streaming`, {
        method: "POST", headers: hdrs(),
        body: JSON.stringify({ publicUrl: publicUrl.trim(), privateUrl: privateUrl.trim() }),
      });
      if (r.ok) setTestResult(await r.json());
    } catch {}
    setTesting(false);
  };

  const isSiteHttps = window.location.protocol === "https:";
  const isHttpUrl = (url: string) => url.trim().toLowerCase().startsWith("http://");
  const publicHttpWarning = isSiteHttps && isHttpUrl(publicUrl);
  const privateHttpWarning = isSiteHttps && isHttpUrl(privateUrl);

  const dot = (ok: boolean) => `inline-block h-2 w-2 rounded-full mr-1.5 ${ok ? "bg-green-400" : "bg-red-400"}`;

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
            {publicHttpWarning && (
              <p className="mt-1 text-xs text-amber-400">{t("admin:directStreamingHttpWarning")}</p>
            )}
          </div>
          <div>
            <label className={cls.lbl}>{t("admin:directStreamingPrivateUrl")}</label>
            <input value={privateUrl} onChange={(e) => setPrivateUrl(e.target.value)}
              placeholder="http://192.168.1.50:8096" className={cls.inp} />
            <p className="mt-1 text-xs text-white/30">{t("admin:directStreamingPrivateUrlHelp")}</p>
            {privateHttpWarning && (
              <p className="mt-1 text-xs text-amber-400">{t("admin:directStreamingHttpWarning")}</p>
            )}
          </div>

          {/* Test results */}
          {testResult && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
              {testResult.public && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={dot(testResult.public.ok)} />
                  <span className="text-white/60">{t("admin:directStreamingPublicUrl")}:</span>
                  <span className={testResult.public.ok ? "text-green-400" : "text-red-400"}>
                    {testResult.public.ok ? `Jellyfin ${testResult.public.version}` : testResult.public.error}
                  </span>
                </div>
              )}
              {testResult.private && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={dot(testResult.private.ok)} />
                  <span className="text-white/60">{t("admin:directStreamingPrivateUrl")}:</span>
                  <span className={testResult.private.ok ? "text-green-400" : "text-red-400"}>
                    {testResult.private.ok ? `Jellyfin ${testResult.private.version}` : testResult.private.error}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={testUrls} disabled={testing || (!publicUrl.trim() && !privateUrl.trim())} className={cls.bs}>
            {testing ? `${t("admin:test")}...` : t("admin:test")}
          </button>
          <button onClick={save} disabled={busy} className={cls.bp}>
            {busy ? "..." : t("admin:save")}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</span>}
        </div>
      </div>
    </div>
  );
}
