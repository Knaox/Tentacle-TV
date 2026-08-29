import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";
import { ToggleSwitch } from "../settings/ToggleSwitch";

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
      <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("playback")}</h2>
      <p className="mb-4 text-sm text-content-quaternary">{t("playbackDescription")}</p>
      <div className={cls.sub}>
        <div className="flex flex-wrap items-center gap-3">
          <label className={cls.lbl}>{t("autoplayNextEnabled")}</label>
          {/* L'interrupteur PARTAGÉ, comme partout ailleurs : celui qui vivait
              ici était une copie au violet plat, dont le pouce s'animait par
              `left` — donc en repeignant à chaque image. */}
          <ToggleSwitch
            checked={enabled}
            onChange={(next) => save(next)}
            label={t("autoplayNextEnabled")}
            disabled={busy}
          />
          {msg && <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>}
        </div>
        <p className="mt-2 text-xs text-content-quaternary">{t("autoplayNextHelp")}</p>
        {pct != null && (
          <p className="mt-1 text-xs text-content-quaternary">{t("autoplayCurrentThreshold", { pct })}</p>
        )}
      </div>
    </div>
  );
}
