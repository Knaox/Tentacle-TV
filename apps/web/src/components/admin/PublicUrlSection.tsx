import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

/**
 * Section "URL publique du serveur" — l'URL publique (domaine Cloudflare) gravée
 * dans la TV au jumelage. Stockée en DB (clé `public_url`, prioritaire) ; à
 * défaut, le backend retombe sur la variable d'env TENTACLE_PUBLIC_URL.
 * Disponible aussi dans l'app desktop (qui embarque ce build web).
 */
export function PublicUrlSection() {
  const { t } = useTranslation("admin");
  const [url, setUrl] = useState("");
  const [envFallback, setEnvFallback] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/admin/public-url`, { headers: hdrs(), credentials: creds() });
        if (r.ok) {
          const d = await r.json();
          setUrl(d.publicUrl ?? "");
          setEnvFallback(d.envFallback ?? "");
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/public-url`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({ publicUrl: url.trim() }),
        credentials: creds(),
      });
      setMsg(r.ok ? { ok: true, t: t("saved") } : { ok: false, t: t("saveFailed") });
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  if (!loaded) return null;
  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("publicUrl")}</h2>
      <p className="mb-4 text-sm text-content-quaternary">{t("publicUrlDescription")}</p>
      <div className={cls.sub}>
        <label className={cls.lbl}>{t("publicUrlLabel")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="url"
            inputMode="url"
            placeholder={envFallback || "https://exemple.tentacletv.app"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${cls.inp} min-w-[260px] flex-1`}
          />
          <button onClick={save} disabled={busy} className={cls.bp}>{busy ? "..." : t("save")}</button>
          {msg && <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>}
        </div>
        <p className="mt-1 text-xs text-content-quaternary">{t("publicUrlHelp")}</p>
      </div>
    </div>
  );
}
