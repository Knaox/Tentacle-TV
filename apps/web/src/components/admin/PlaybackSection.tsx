import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

/**
 * Section "Lecture" — interrupteur « Déclenchement auto-play ». Le SEUIL n'est
 * plus configuré ici (plus de minutes) : c'est le « pourcentage maximal de
 * reprise » (MaxResumePct) de Jellyfin, affiché à titre indicatif. Extraite
 * depuis Admin.tsx pour respect de la limite 300L par fichier.
 */
export function PlaybackSection() {
  const { t } = useTranslation("admin");
  const [enabled, setEnabled] = useState(true);
  const [pct, setPct] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/admin/playback`, { headers: hdrs(), credentials: creds() });
        if (r.ok) {
          const d = await r.json();
          setEnabled(d.autoplayNextEnabled ?? true);
        }
      } catch { /* ignore */ }
      try {
        const r = await fetch(`${BACKEND}/api/config/autoplay`);
        if (r.ok) setPct((await r.json()).maxResumePct ?? null);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  const save = async (next: boolean) => {
    setBusy(true);
    setMsg(null);
    setEnabled(next);
    try {
      const r = await fetch(`${BACKEND}/api/admin/playback`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({ autoplayNextEnabled: next }),
        credentials: creds(),
      });
      setMsg(r.ok ? { ok: true, t: t("saved") } : { ok: false, t: t("saveFailed") });
      if (!r.ok) setEnabled(!next);
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
      setEnabled(!next);
    }
    setBusy(false);
  };

  if (!loaded) return null;
  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-white">{t("playback")}</h2>
      <p className="mb-4 text-sm text-white/40">{t("playbackDescription")}</p>
      <div className={cls.sub}>
        <div className="flex flex-wrap items-center gap-3">
          <label className={cls.lbl}>{t("autoplayNextEnabled")}</label>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => save(!enabled)}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ${enabled ? "bg-[var(--brand)]" : "bg-white/15"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-150 ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
          {msg && <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>}
        </div>
        <p className="mt-2 text-xs text-white/30">{t("autoplayNextHelp")}</p>
        {pct != null && (
          <p className="mt-1 text-xs text-white/40">{t("autoplayCurrentThreshold", { pct })}</p>
        )}
      </div>
    </div>
  );
}
