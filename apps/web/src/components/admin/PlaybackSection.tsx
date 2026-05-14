import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

/**
 * Section "Lecture" — paramètre autoplay credits minutes. Extraite depuis
 * Admin.tsx pour respect de la limite 300L par fichier.
 */
export function PlaybackSection() {
  const { t } = useTranslation("admin");
  const [minutes, setMinutes] = useState(2);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/admin/playback`, { headers: hdrs(), credentials: creds() });
        if (r.ok) {
          const d = await r.json();
          setMinutes(d.autoplayCreditsMinutes ?? 2);
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/playback`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({ autoplayCreditsMinutes: minutes }),
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
      <h2 className="mb-1 text-lg font-semibold text-white">{t("playback")}</h2>
      <p className="mb-4 text-sm text-white/40">{t("playbackDescription")}</p>
      <div className={cls.sub}>
        <label className={cls.lbl}>{t("autoplayCreditsMinutes")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input type="number" min={0} max={30} step={0.5} value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={`${cls.inp} w-24`} />
          <span className="text-xs text-white/40">min</span>
          <button onClick={save} disabled={busy} className={cls.bp} style={cls.bpStyle}>{busy ? "..." : t("save")}</button>
          {msg && <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>}
        </div>
        <p className="mt-1 text-xs text-white/30">{t("autoplayCreditsHelp")}</p>
      </div>
    </div>
  );
}
